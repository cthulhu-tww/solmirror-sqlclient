import { useEffect, useState } from 'react';
import Sheet from './Sheet.jsx';
import { api } from '../api.js';
import { toast } from './Toast.jsx';
import { IconTable, IconKey, IconBolt, IconPlay } from './Icons.jsx';

// 库表浏览器：库 → 表 → 结构；表操作/表名插入编辑器
export default function SchemaDrawer({ connId, currentDb, onClose, onUseDb, onInsertText, onRunSql }) {
  const [dbs, setDbs] = useState([]);
  const [tables, setTables] = useState(null);   // null=未加载
  const [loadingTbl, setLoadingTbl] = useState(false);
  const [tableDetail, setTableDetail] = useState(null); // { name, columns, indexes, ddl? }
  const [actionTbl, setActionTbl] = useState(null);     // 当前弹操作单的表

  useEffect(() => {
    api.databases(connId).then(d => {
      setDbs(d.databases || []);
      if (!currentDb && d.current) onUseDb(d.current, true);
    }).catch(e => toast(e.message, 'err'));
  }, [connId]);

  useEffect(() => {
    if (!currentDb) return;
    setLoadingTbl(true);
    api.tables(connId, currentDb)
      .then(r => setTables(r.tables || []))
      .catch(e => toast(e.message, 'err'))
      .finally(() => setLoadingTbl(false));
  }, [connId, currentDb]);

  const switchDb = async (db) => {
    if (db === currentDb) return;
    try {
      await api.useDb(connId, db);
      onUseDb(db);
      toast(`已切换到 ${db}`, 'ok');
    } catch (e) { toast(e.message, 'err'); }
  };

  const openStructure = async (t) => {
    setActionTbl(null);
    try {
      const r = await api.columns(connId, currentDb, t);
      setTableDetail({ name: t, ...r });
    } catch (e) { toast(e.message, 'err'); }
  };

  const q = (sql) => { setActionTbl(null); onClose(); onRunSql(sql); };

  return (
    <Sheet title={<><IconTable width={18} height={18} />库表浏览</>} onClose={onClose}>
      {/* 数据库选择 */}
      <div className="kwtabs" style={{ marginBottom: 10 }}>
        {dbs.map(db => (
          <button key={db} className={db === currentDb ? 'on' : ''} onClick={() => switchDb(db)}>{db}</button>
        ))}
      </div>

      {loadingTbl && <div className="empty mut">加载表中…</div>}
      {tables && !tables.length && <div className="empty"><div className="big">🗂</div>该库没有表</div>}

      <div className="schemalist">
        {(tables || []).map(t => (
          <div key={t.name} className={`schemarow ${actionTbl === t.name ? 'cur' : ''}`} onClick={() => setActionTbl(actionTbl === t.name ? null : t.name)}>
            <IconTable width={17} height={17} style={{ color: 'var(--muted)', flex: 'none' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="tname">{t.name}</div>
              {(t.comment || t.rowsEst) && (
                <div className="tsub">{t.comment}{t.comment && t.rowsEst ? ' · ' : ''}{t.rowsEst ? `≈${t.rowsEst} 行` : ''}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 表操作 */}
      {actionTbl && (
        <div style={{ position: 'sticky', bottom: 0, background: 'var(--bg2)', paddingTop: 10, borderTop: '1px solid var(--border)' }}>
          <div className="small mut" style={{ marginBottom: 8 }}>
            <b style={{ fontFamily: 'var(--mono)' }}>{actionTbl}</b> 的操作：
          </div>
          <div className="row" style={{ flexWrap: 'wrap', gap: 7 }}>
            <button className="btn sm" onClick={() => q(`SELECT *\nFROM \`${actionTbl}\`\nLIMIT 100;`)}><IconPlay width={13} height={13} /> 查数据</button>
            <button className="btn sm" onClick={() => q(`SELECT COUNT(*) AS cnt\nFROM \`${actionTbl}\`;`)}> 行数</button>
            <button className="btn sm" onClick={() => openStructure(actionTbl)}> 结构</button>
            <button className="btn sm" onClick={() => { onInsertText(`\`${actionTbl}\``); toast('表名已插入编辑器', 'ok'); onClose(); }}> ↗ 插入表名</button>
          </div>
        </div>
      )}

      {/* 表结构 */}
      {tableDetail && (
        <Sheet title={<><IconKey width={18} height={18} />{tableDetail.name} · 结构</>} onClose={() => setTableDetail(null)}>
          {tableDetail.columns.map(c => (
            <div key={c.name} className="colrow" onClick={() => { onInsertText(`\`${c.name}\``); toast('列名已插入', 'ok'); onClose(); }}>
              <span className="cname">{c.name}</span>
              {c.keyKind === 'PRI' && <span className="chisk danger">主键</span>}
              {c.keyKind === 'UNI' && <span className="chisk info">唯一</span>}
              {c.keyKind === 'MUL' && <span className="chisk gray">索引</span>}
              <span className="ctype">{c.type}</span>
              <span className="ccmt">{c.comment || ''}</span>
            </div>
          ))}
          {tableDetail.indexes?.length > 0 && (
            <>
              <div className="datehead">索引</div>
              {tableDetail.indexes.reduce((acc, idx) => {
                if (!acc.find(a => a.name === idx.name)) acc.push(idx);
                return acc;
              }, []).map(idx => (
                <div key={idx.name} className="colrow">
                  <span className="cname">{idx.name}</span>
                  <span className="chisk gray">{idx.nonUnique == 0 ? '唯一' : '普通'}</span>
                  <span className="ccmt">
                    {tableDetail.indexes.filter(i => i.name === idx.name).map(i => i.column_name).join(', ')}
                  </span>
                </div>
              ))}
            </>
          )}
          <div className="small mut" style={{ marginTop: 10 }}>点击列名可插入到编辑器</div>
        </Sheet>
      )}
    </Sheet>
  );
}
