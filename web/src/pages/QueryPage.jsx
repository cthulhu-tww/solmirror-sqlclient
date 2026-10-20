import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'sql-formatter';
import { useApp, ENV_LABELS, fmtMs } from '../store.js';
import { api } from '../api.js';
import { analyzeSql, isReadOnly, buildCountPreview } from '../lib/sqlDanger.js';
import { detectEditTarget, buildUpdateSql } from '../lib/editSql.js';
import { explainError } from '../lib/errMap.js';
import Editor from '../components/Editor.jsx';
import KeywordBar from '../components/KeywordBar.jsx';
import RunGuard from '../components/RunGuard.jsx';
import ResultGrid from '../components/ResultGrid.jsx';
import SchemaDrawer from '../components/SchemaDrawer.jsx';
import SnippetsSheet from '../components/SnippetsSheet.jsx';
import EditCellSheet from '../components/EditCellSheet.jsx';
import ApplyEdits from '../components/ApplyEdits.jsx';
import Sheet from '../components/Sheet.jsx';
import { toast } from '../components/Toast.jsx';
import { IconPlay, IconBolt, IconShield, IconWand, IconBook, IconStar, IconTrash, IconChevron, IconTable } from '../components/Icons.jsx';

export default function QueryPage() {
  const nav = useNavigate();
  const { activeConn, currentDb, setCurrentDb, safeMode, toggleSafe, maxRows, addHistory, isFavorited, addFavorite, pendingSql, setPendingSql, saveDraft, loadDraft } = useApp();
  const editorRef = useRef(null);

  const [sql, setSql] = useState(() => loadDraft());
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [guard, setGuard] = useState(null);       // { statement, safeBlocked, preview }
  const [showSchema, setShowSchema] = useState(false);
  const [showSnip, setShowSnip] = useState(false);
  const [schemaMap, setSchemaMap] = useState({});
  const [priMap, setPriMap] = useState({});     // { table: [主键列] }
  const [typesMap, setTypesMap] = useState({}); // { table: { 列: 类型 } }
  const resultRef = useRef(null);

  // 结果集编辑：edits { 原始行号: { 列: { v, isNull } } }
  const [edits, setEdits] = useState({});
  const [editCell, setEditCell] = useState(null);       // { rowIndex, column }
  const [applySheet, setApplySheet] = useState(null);   // { stmts, table, error }
  const [applying, setApplying] = useState(false);
  const lastQueryRef = useRef('');                      // 最近一次产生行结果的 SELECT（应用后刷新用）

  const analysis = useMemo(() => analyzeSql(sql), [sql]);
  const isProd = activeConn?.env === 'prod';

  // 从历史/收藏载入
  useEffect(() => {
    if (pendingSql != null) {
      setSql(pendingSql);
      editorRef.current?.setValue(pendingSql);
      setPendingSql(null);
      setGuard(null);
    }
  }, [pendingSql, setPendingSql]);

  // 没选库时自动取连接的当前库（补全依赖库元数据）
  useEffect(() => {
    if (!activeConn || currentDb) return;
    let alive = true;
    api.databases(activeConn.id)
      .then(d => { if (alive && d.current) setCurrentDb(d.current); })
      .catch(() => {});
    return () => { alive = false; };
  }, [activeConn?.id, currentDb]);

  // 加载当前库的列信息（用于自动补全 + 结果集编辑的主键/类型）
  useEffect(() => {
    if (!activeConn || !currentDb) { setSchemaMap({}); setPriMap({}); setTypesMap({}); return; }
    let alive = true;
    api.columnsAll(activeConn.id, currentDb)
      .then(r => {
        if (!alive) return;
        setSchemaMap(r.columns || {});
        setPriMap(r.pri || {});
        setTypesMap(r.types || {});
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [activeConn?.id, currentDb]);

  const onChange = (v) => { setSql(v); saveDraft(v); };

  // ---------- 执行流程 ----------
  const run = () => {
    if (!activeConn) { toast('请先选择连接', 'err'); nav('/'); return; }
    if (running) return;
    if (analysis.empty) { toast('请输入 SQL 语句', 'err'); return; }
    const stmt = analysis.statements[0];

    if (analysis.multi) { setGuard({ statement: stmt, multi: true }); return; }
    if (safeMode && !isReadOnly(stmt.sql)) { setGuard({ statement: stmt, safeBlocked: true }); return; }
    if (stmt.risk === 'high' || stmt.risk === 'medium') { setGuard({ statement: stmt }); return; }
    execute(stmt.sql);
  };

  const execute = async (sqlText, opts = {}) => {
    setGuard(null);
    setRunning(true);
    setResult(null);
    setEdits({});   // 换了结果集，旧修改作废
    const t0 = performance.now();
    let entry = null;
    try {
      const r = await api.query(activeConn.id, sqlText, maxRows);
      setResult(r);
      if (r.kind === 'rows') lastQueryRef.current = sqlText;
      entry = { connId: activeConn.id, connName: activeConn.name, env: activeConn.env, sql: sqlText, ms: r.durationMs ?? Math.round(performance.now() - t0), ok: true, risk: opts.risk || 'low' };
    } catch (e) {
      setResult({ kind: 'error', error: e.message, hint: e.hint, errno: e.errno, sqlMessage: e.sqlMessage });
      entry = { connId: activeConn.id, connName: activeConn.name, env: activeConn.env, sql: sqlText, ms: Math.round(performance.now() - t0), ok: false, risk: opts.risk || 'low' };
      if (!opts.silent) toast(e.message, 'err');
    } finally {
      setRunning(false);
      if (entry && !opts.noHistory) addHistory(entry);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    }
  };

  // 预览影响行数：把 UPDATE/DELETE 改写成 SELECT COUNT(*)
  const previewCount = () => {
    const stmt = guard?.statement || analysis.statements[0];
    const p = buildCountPreview(stmt.sql);
    const table = p?.table || stmt.targets?.[0];
    if (!table) { toast('无法识别目标表，请手动改写', 'err'); return; }
    execute(p?.sql || `SELECT COUNT(*) AS affected_rows FROM ${table}`, { risk: 'low' });
  };

  const runExplain = () => {
    if (analysis.empty) { toast('请先输入 SQL', 'err'); return; }
    const stmt = analysis.statements[0].sql.replace(/;\s*$/, '');
    if (!/^(SELECT|UPDATE|DELETE|INSERT)/i.test(stmt)) { toast('EXPLAIN 支持 SELECT / INSERT / UPDATE / DELETE', 'err'); return; }
    execute(`EXPLAIN ${stmt}`, { noHistory: true });
  };

  const doFormat = () => {
    if (!sql.trim()) return;
    try {
      const f = format(sql, { language: 'mysql', keywordCase: 'upper' });
      setSql(f); saveDraft(f);
      editorRef.current?.setValue(f);
      toast('已格式化', 'ok');
    } catch { toast('格式化失败：SQL 可能有语法错误', 'err'); }
  };

  const doFavorite = () => {
    if (!sql.trim()) { toast('编辑器是空的', 'err'); return; }
    if (isFavorited(sql.trim())) { toast('已收藏过这条 SQL', ''); return; }
    addFavorite(sql.trim());
    toast('已加入收藏', 'ok');
  };

  // ---------- 结果集编辑 ----------
  // 判断当前结果是否可编辑：单表简单 SELECT + 表在当前库 + 主键列都在结果里
  const editCtx = useMemo(() => {
    if (!result || result.kind !== 'rows') return null;
    const t = detectEditTarget(lastQueryRef.current);
    if (!t) return null;
    const cols = schemaMap[t.table];
    const pk = priMap[t.table];
    if (!cols || !pk || !pk.length) return null;
    if (!pk.every(p => result.columns.includes(p))) return null;
    return { table: t.table, quoted: t.quoted, pkCols: pk, colSet: new Set(cols) };
  }, [result, schemaMap, priMap]);

  const editCount = useMemo(
    () => Object.values(edits).reduce((n, rowEdits) => n + Object.keys(rowEdits).length, 0),
    [edits]
  );

  const saveEdit = (rowIndex, column, v) => {
    const orig = result?.rows?.[rowIndex]?.[column];
    const noChange = (v === null && orig === null) || (v !== null && orig !== null && String(orig) === v);
    setEdits(prev => {
      const next = { ...prev };
      const rowEdits = { ...(next[rowIndex] || {}) };
      if (noChange) delete rowEdits[column];
      else rowEdits[column] = { v, isNull: v === null };
      if (Object.keys(rowEdits).length) next[rowIndex] = rowEdits; else delete next[rowIndex];
      return next;
    });
    setEditCell(null);
    toast(noChange ? '和原值相同，未记录修改' : '已记录修改（黄底标记），点「应用」执行', 'ok');
  };

  const openApply = () => {
    if (!editCtx || !result?.rows) return;
    const stmts = [];
    for (const [idxStr, rowEdits] of Object.entries(edits)) {
      const row = result.rows[+idxStr];
      if (!row) continue;
      const sets = Object.entries(rowEdits).map(([col, e]) => ({ col, value: e.isNull ? null : e.v }));
      const where = editCtx.pkCols.map(p => ({ col: p, value: row[p] }));
      if (where.some(w => w.value === null || typeof w.value === 'object')) {
        toast('主键值异常（NULL/BLOB），无法安全定位该行', 'err');
        return;
      }
      stmts.push(buildUpdateSql({ quoted: editCtx.quoted, sets, where }));
    }
    if (!stmts.length) { toast('没有可应用的修改', 'err'); return; }
    setApplySheet({ stmts, table: editCtx.table, error: '' });
  };

  const runApply = async () => {
    if (!applySheet || applying) return;
    setApplying(true);
    let affected = 0, done = 0, firstErr = '';
    for (const s of applySheet.stmts) {
      try {
        const r = await api.query(activeConn.id, s, maxRows);
        affected += r.affectedRows || 0;
        done++;
        addHistory({ connId: activeConn.id, connName: activeConn.name, env: activeConn.env, sql: s, ms: r.durationMs || 0, ok: true, risk: 'medium' });
      } catch (e) {
        firstErr = e.message;
        break;
      }
    }
    setApplying(false);
    if (firstErr) {
      setApplySheet(a => ({ ...a, error: `${firstErr}（前 ${done} 条已执行，剩余未执行）` }));
      return;
    }
    toast(`✅ 已更新 ${applySheet.stmts.length} 条，共影响 ${affected} 行`, 'ok');
    setApplySheet(null);
    setEdits({});
    if (lastQueryRef.current) execute(lastQueryRef.current, { noHistory: true, risk: 'low' });
  };

  const runGuardSheet = guard && (
    <RunGuard
      analysis={analysis}
      statement={guard.statement}
      safeBlocked={guard.safeBlocked}
      isProd={isProd}
      onRun={() => execute(guard.statement.sql, { risk: guard.statement.risk })}
      onPreviewCount={/^(UPDATE|DELETE)\b/i.test(guard.statement.sql) ? previewCount : null}
      onDisableSafe={() => { toggleSafe(false); setGuard(null); toast('安全模式已关闭', 'err'); setTimeout(run, 150); }}
      onClose={() => setGuard(null)}
    />
  );

  if (!activeConn) {
    return (
      <div className="page page--notab">
        <div className="pagehead"><h1>查询</h1></div>
        <div className="card empty">
          <div className="big">🔌</div>
          还没有选择数据库连接
          <div style={{ marginTop: 16 }}><Link className="btn primary" to="/">去选择连接</Link></div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      {/* 生产环境红条 */}
      {isProd && <div className="prodstrip"><IconShield width={15} height={15} />生产环境 · {activeConn.name} · 操作务必谨慎</div>}

      {/* 顶栏：库切换 + 安全模式 */}
      <div className="qhead">
        <div className="dbchip" onClick={() => setShowSchema(true)}>
          <IconTable width={15} height={15} style={{ color: 'var(--accent)' }} />
          <span className="mut">库</span>
          <span className="db">{currentDb || '未选择'}</span>
          <IconChevron width={13} height={13} style={{ color: 'var(--muted)' }} />
        </div>
        <button
          className={`btn sm ${safeMode ? '' : 'ghost'}`}
          style={safeMode ? { background: 'var(--ok-bg)', color: 'var(--ok)', borderColor: 'transparent' } : {}}
          onClick={() => { toggleSafe(); toast(safeMode ? '安全模式已关闭' : '安全模式已开启：仅允许查询', safeMode ? 'err' : 'ok'); }}
        >
          <IconShield width={14} height={14} />{safeMode ? '只读中' : '可写'}
        </button>
      </div>

      {/* 编辑器 */}
      <div className="editorcard card">
        <Editor ref={editorRef} value={sql} onChange={onChange} schema={schemaMap} />
      </div>

      {/* 关键词快捷栏 */}
      <KeywordBar editorRef={editorRef} />

      {/* 操作行 */}
      <div className="actrow">
        <button
          className={`btn runbtn ${analysis.overall === 'high' ? 'danger' : analysis.overall === 'medium' ? '' : 'primary'}`}
          disabled={running}
          onClick={run}
        >
          {running ? <span className="spin" /> : <IconPlay width={15} height={15} />}
          {running ? '执行中…' : '执 行'}
          {!running && analysis.overall === 'high' && <span className="small">· 高危</span>}
          {!running && analysis.overall === 'medium' && <span className="small">· 需确认</span>}
        </button>
        <button className="btn" disabled={running} onClick={runExplain} title="查看执行计划">
          <IconBolt width={15} height={15} />EXPLAIN
        </button>
      </div>
      <div className="actmini">
        <button className="btn sm" onClick={doFormat}><IconWand width={14} height={14} />格式化</button>
        <button className="btn sm" onClick={() => setShowSnip(true)}><IconBook width={14} height={14} />片段</button>
        <button className="btn sm" onClick={doFavorite}><IconStar width={14} height={14} />收藏</button>
        <button className="btn sm" onClick={() => { setSql(''); setResult(null); editorRef.current?.setValue(''); }}><IconTrash width={14} height={14} />清空</button>
      </div>

      {/* 结果区 */}
      <div ref={resultRef}>
        {result?.kind === 'rows' && (
          <>
            <div className="rmeta">
              <span className="chisk info">{result.returned} 行</span>
              {result.truncated && <span className="chisk warn">已截断 · 共 {result.total} 行（上限 {maxRows}）</span>}
              {editCtx && <span className="chisk gray">✏️ 点单元格可改值</span>}
              <span className="time">⏱ {fmtMs(result.durationMs)}</span>
            </div>
            {editCount > 0 && (
              <div className="editbar">
                <span className="editnum">✏️ {editCount} 处修改待应用</span>
                <button className="btn sm" onClick={() => setEdits({})}>放弃</button>
                <button className="btn sm primary" onClick={openApply}>应用</button>
              </div>
            )}
            <ResultGrid
              result={result}
              edits={edits}
              isColEditable={editCtx ? (c) => editCtx.colSet.has(c) : null}
              onEditCell={(rowIndex, column) => setEditCell({ rowIndex, column })}
            />
          </>
        )}
        {result?.kind === 'affected' && (
          <div className="card" style={{ padding: '16px 14px' }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>✅ 执行成功</div>
                <div className="mut small" style={{ marginTop: 4 }}>
                  影响 {result.affectedRows} 行{result.insertId ? ` · 自增 ID: ${result.insertId}` : ''}
                </div>
              </div>
              <span className="time">⏱ {fmtMs(result.durationMs)}</span>
            </div>
          </div>
        )}
        {result?.kind === 'error' && <ErrorCard errno={result.errno} message={result.error} sqlMessage={result.sqlMessage} hint={result.hint} />}
        {!result && !running && (
          <div className="card empty">
            <div className="big">📊</div>
            执行结果将显示在这里
            <div className="small" style={{ marginTop: 6 }}>
              危险词会在编辑器里<b style={{ color: 'var(--danger)' }}>标红</b>/<b style={{ color: 'var(--warn)' }}>标黄</b>，高危语句需长按确认
            </div>
          </div>
        )}
      </div>

      {runGuardSheet}
      {editCell && result?.kind === 'rows' && (
        <EditCellSheet
          column={editCell.column}
          table={editCtx?.table}
          colType={editCtx ? typesMap[editCtx.table]?.[editCell.column] : null}
          original={result.rows[editCell.rowIndex]?.[editCell.column]}
          current={edits[editCell.rowIndex]?.[editCell.column]}
          onSave={(v) => saveEdit(editCell.rowIndex, editCell.column, v)}
          onClose={() => setEditCell(null)}
        />
      )}
      {applySheet && (
        <ApplyEdits
          stmts={applySheet.stmts}
          table={applySheet.table}
          isProd={isProd}
          safeMode={safeMode}
          applying={applying}
          error={applySheet.error}
          onRun={runApply}
          onDisableSafe={() => { toggleSafe(false); toast('安全模式已关闭，可重新点「应用」', 'err'); }}
          onClose={() => setApplySheet(null)}
        />
      )}
      {showSchema && (
        <SchemaDrawer
          connId={activeConn.id}
          currentDb={currentDb}
          onClose={() => setShowSchema(false)}
          onUseDb={(db) => setCurrentDb(db)}
          onInsertText={(t) => editorRef.current?.insert(t)}
          onRunSql={(s) => { setSql(s); editorRef.current?.setValue(s); saveDraft(s); execute(s.replace(/;\s*$/, ''), { risk: 'low' }); }}
        />
      )}
      {showSnip && (
        <SnippetsSheet
          onClose={() => setShowSnip(false)}
          onUse={(s) => { setSql(s); editorRef.current?.setValue(s); saveDraft(s); setShowSnip(false); toast('已填入编辑器', 'ok'); }}
        />
      )}
    </div>
  );
}

function ErrorCard({ errno, message, sqlMessage, hint }) {
  const ex = explainError(errno, message, sqlMessage);
  return (
    <div className="errcard card">
      <div className="ehead"><IconShield width={15} height={15} />❌ {ex.title || '执行出错'}{errno ? ` (${errno})` : ''}</div>
      {(ex.hint || hint) && <div className="ehint">💡 {ex.hint || hint}</div>}
      <div className="eraw">{sqlMessage || message}</div>
    </div>
  );
}
