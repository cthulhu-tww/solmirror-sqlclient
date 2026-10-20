// SQL 危险分析引擎：纯函数、无 DOM 依赖。
// 前端三处复用：编辑器内危险词高亮、执行前风险弹层、预览影响行数改写。

// ---------- 分词器 ----------
// token: { t: 'word'|'string'|'ident'|'comment'|'number'|'op'|'ws', v, start, end }
export function tokenize(sql) {
  const tokens = [];
  let i = 0;
  const n = sql.length;
  while (i < n) {
    const c = sql[i];
    if (c === '-' && sql[i + 1] === '-') {
      let j = sql.indexOf('\n', i); if (j < 0) j = n;
      tokens.push({ t: 'comment', v: sql.slice(i, j), start: i, end: j }); i = j; continue;
    }
    if (c === '#') {
      let j = sql.indexOf('\n', i); if (j < 0) j = n;
      tokens.push({ t: 'comment', v: sql.slice(i, j), start: i, end: j }); i = j; continue;
    }
    if (c === '/' && sql[i + 1] === '*') {
      let j = sql.indexOf('*/', i + 2); j = j < 0 ? n : j + 2;
      tokens.push({ t: 'comment', v: sql.slice(i, j), start: i, end: j }); i = j; continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      let j = i + 1;
      while (j < n) {
        if (sql[j] === '\\') { j += 2; continue; }
        if (sql[j] === c) { j++; break; }
        j++;
      }
      const end = Math.min(j, n);
      tokens.push({ t: c === '`' ? 'ident' : 'string', v: sql.slice(i, end), start: i, end }); i = end; continue;
    }
    if (/\s/.test(c)) {
      let j = i; while (j < n && /\s/.test(sql[j])) j++;
      tokens.push({ t: 'ws', v: sql.slice(i, j), start: i, end: j }); i = j; continue;
    }
    if (/[0-9]/.test(c)) {
      let j = i;
      while (j < n && /[0-9a-fA-F.x'eE]/.test(sql[j])) {
        if ((sql[j] === '+' || sql[j] === '-') && !/[eE]/.test(sql[j - 1] || '')) break;
        j++;
      }
      tokens.push({ t: 'number', v: sql.slice(i, j), start: i, end: j }); i = j; continue;
    }
    if (/[A-Za-z_$\u4e00-\u9fa5]/.test(c)) {
      let j = i; while (j < n && /[A-Za-z0-9_$\u4e00-\u9fa5]/.test(sql[j])) j++;
      tokens.push({ t: 'word', v: sql.slice(i, j), start: i, end: j }); i = j; continue;
    }
    tokens.push({ t: 'op', v: c, start: i, end: i + 1 }); i++;
  }
  return tokens;
}

// ---------- 语句切分（按顶层分号，忽略字符串/注释里的） ----------
export function splitStatements(sql) {
  const tokens = tokenize(sql);
  const stmts = [];
  let cur = [];
  const flush = (endIdx) => {
    const text = tokensText(tokens, cur);
    if (text.trim()) stmts.push({ sql: text.trim(), start: cur[0].start, end: endIdx });
    cur = [];
  };
  for (const tk of tokens) {
    if (tk.t === 'op' && tk.v === ';') { flush(tk.start); continue; }
    if (tk.t === 'comment' || tk.t === 'ws') {
      // 语句间的空白/注释：若当前为空则丢弃（不算语句起始），否则并入
      if (cur.length) cur.push(tk);
      continue;
    }
    cur.push(tk);
  }
  flush(n(sql));
  return stmts;
}
function n(sql) { return sql.length; }
function tokensText(tokens, list) {
  if (!list.length) return '';
  return tokens.slice(0, 0).concat(list).map(t => t.v).join('');
}

// ---------- 风险分级 ----------
// risk: 'high' 红 | 'medium' 黄 | 'low' 绿 | 'block' 拦截(不执行)
const HIGH_WORDS = ['DROP', 'TRUNCATE', 'SHUTDOWN', 'GRANT', 'REVOKE'];
const WRITE_WORDS = ['INSERT', 'REPLACE', 'UPDATE', 'DELETE', 'ALTER', 'CREATE', 'RENAME', 'KILL', 'FLUSH', 'RESET', 'LOAD', 'CALL', 'LOCK', 'UNLOCK'];
const SAFE_LEADERS = ['SELECT', 'SHOW', 'DESC', 'DESCRIBE', 'EXPLAIN', 'USE', 'SET', 'BEGIN', 'START', 'COMMIT', 'ROLLBACK', 'WITH', 'ANALYZE', 'OPTIMIZE'];

export function analyzeStatement(stmtSql) {
  const tokens = tokenize(stmtSql).filter(t => t.t !== 'ws' && t.t !== 'comment');
  const words = tokens.filter(t => t.t === 'word').map(t => t.v.toUpperCase());
  const upperSql = words.join(' ');
  const reasons = [];
  let risk = 'low';
  let kind = 'other';

  const raise = (level, reason) => {
    reasons.push({ level, reason });
    if (level === 'high') risk = 'high';
    else if (level === 'medium' && risk !== 'high') risk = 'medium';
  };

  const leader = words.find(w => /^[A-Z]/.test(w)) || '';

  if (!tokens.length || !stmtSql.trim()) {
    return { risk: 'block', kind: 'empty', reasons: [{ level: 'block', reason: '空语句' }] };
  }

  // 语句类型
  if (leader === 'SELECT' || leader === 'WITH') kind = 'select';
  else if (['INSERT', 'UPDATE', 'DELETE', 'REPLACE'].includes(leader)) kind = 'dml';
  else if (['CREATE', 'ALTER', 'DROP', 'TRUNCATE', 'RENAME'].includes(leader)) kind = 'ddl';
  else if (leader === 'SHOW' || leader === 'DESC' || leader === 'DESCRIBE' || leader === 'EXPLAIN' || leader === 'USE') kind = 'meta';
  else kind = 'other';

  const hasWord = (w) => words.includes(w);
  const targets = extractTargets(tokens, leader);

  // --- 高危关键词 ---
  if (hasWord('DROP')) {
    const obj = hasWord('DATABASE') || hasWord('SCHEMA') ? '整个数据库' : hasWord('INDEX') ? '索引' : '表';
    raise('high', `DROP：将永久删除${obj}，且不可恢复`);
  }
  if (hasWord('TRUNCATE')) raise('high', 'TRUNCATE：清空整表数据，不可恢复（不做行级 binlog）');
  if (hasWord('SHUTDOWN')) raise('high', 'SHUTDOWN：将关闭整个 MySQL 实例');
  if (hasWord('GRANT')) raise('high', 'GRANT：授予账号权限，放大会面');
  if (hasWord('REVOKE')) raise('high', 'REVOKE：回收账号权限');

  // --- DELETE / UPDATE 的 WHERE 检测 ---
  const hasWhere = hasWord('WHERE');
  if (leader === 'DELETE') {
    if (!hasWhere) raise('high', 'DELETE 没有 WHERE 条件：将删除全表数据');
    else raise('medium', 'DELETE 删除数据，建议先「预览影响行数」');
  }
  if (leader === 'UPDATE') {
    if (!hasWhere) raise('high', 'UPDATE 没有 WHERE 条件：将更新全表数据');
    else raise('medium', 'UPDATE 修改数据，建议先「预览影响行数」');
  }
  if (leader === 'REPLACE' || leader === 'INSERT') {
    raise('medium', '写入数据：将新增/覆盖行');
  }

  // ALTER 细分
  if (leader === 'ALTER' || hasWord('ALTER')) {
    if (/\bDROP\s+(COLUMN|INDEX|KEY|PARTITION|FOREIGN)\b/.test(upperSql)) {
      raise('high', 'ALTER … DROP：删除列/索引，数据会丢失');
    } else if (leader === 'ALTER') {
      raise('medium', 'ALTER：修改表结构，大表可能长时间锁表');
    }
  }
  if (leader === 'CREATE') raise('medium', 'CREATE：创建/覆盖对象（IF NOT EXISTS 缺失时可能报错）');
  if (leader === 'RENAME') raise('medium', 'RENAME：重命名对象');
  if (hasWord('KILL')) raise('medium', 'KILL：终止连接/查询，可能中断他人事务');
  if (/SET\s+GLOBAL/.test(upperSql)) raise('medium', 'SET GLOBAL：修改实例全局变量，重启前持续生效');
  if (leader === 'FLUSH' || leader === 'RESET') raise('medium', 'FLUSH/RESET：刷新/重置服务器状态');
  if (leader === 'LOCK' || leader === 'UNLOCK') raise('medium', 'LOCK/UNLOCK TABLES：影响其他会话读写');
  if (/FOR\s+UPDATE|FOR\s+SHARE|LOCK\s+IN\s+SHARE\s+MODE/.test(upperSql)) raise('medium', 'SELECT 带锁（FOR UPDATE/SHARE）：会持有行锁');

  // --- 提示级（不影响 risk） ---
  const hints = [];
  if (kind === 'select') {
    if (!hasWord('LIMIT') && !/COUNT\s*\(/.test(upperSql) && !/information_schema|performance_schema|mysql/.test(upperSql)) {
      hints.push('未加 LIMIT：大表可能返回海量数据，建议加 LIMIT');
    }
  }
  if (upperSql.length > 4000) hints.push('语句较长，手机上建议先格式化检查');

  return { risk, kind, reasons, hints, targets };
}

function extractTargets(tokens, leader) {
  // 识别语句操作的目标表：DELETE FROM x / UPDATE x / INSERT INTO x / DROP TABLE x / ALTER TABLE x / FROM x (select)
  const out = [];
  const push = (v) => { if (v && !out.includes(v)) out.push(v); };
  for (let i = 0; i < tokens.length - 1; i++) {
    const w = tokens[i].t === 'word' ? tokens[i].v.toUpperCase() : '';
    const next = tokens[i + 1];
    const nextVal = next && (next.t === 'word' || next.t === 'ident') ? next.v.replace(/[`'"]/g, '') : '';
    if (!nextVal) continue;
    if ((w === 'FROM' || w === 'INTO' || w === 'TABLE' || w === 'UPDATE') && !['SELECT', 'WHERE', 'SET', 'VALUES', 'ON', 'DUPLICATE'].includes(nextVal.toUpperCase())) {
      push(nextVal);
    }
  }
  return out;
}

// ---------- 入口：分析整个编辑器内容 ----------
export function analyzeSql(sql) {
  const stmts = splitStatements(sql || '');
  const statements = stmts.map(s => {
    const a = analyzeStatement(s.sql);
    return { sql: s.sql, start: s.start, ...a };
  });

  const multi = statements.length > 1;
  let overall = 'low';
  for (const s of statements) {
    if (s.risk === 'high') { overall = 'high'; break; }
    if (s.risk === 'medium') overall = 'medium';
  }
  const hints = statements.flatMap(s => s.hints || []);
  if (multi) hints.unshift(`检测到 ${statements.length} 条语句：本客户端一次只执行一条，请只保留需要执行的语句（或删除多余的分号）`);

  return { statements, overall, multi, hints, empty: statements.length === 0 };
}

// ---------- 安全模式（只读）判定 ----------
export function isReadOnly(stmtSql) {
  const tokens = tokenize(stmtSql).filter(t => t.t !== 'ws' && t.t !== 'comment');
  const words = tokens.filter(t => t.t === 'word').map(t => t.v.toUpperCase());
  const leader = words[0] || '';
  if (['SELECT', 'SHOW', 'DESC', 'DESCRIBE', 'EXPLAIN', 'USE', 'WITH', 'ANALYZE'].includes(leader)) {
    // SELECT 带锁仍算写
    const joined = words.join(' ');
    return !/FOR\s+UPDATE|FOR\s+SHARE|LOCK\s+IN\s+SHARE\s+MODE/.test(joined);
  }
  if (leader === 'SET') {
    return !/\bGLOBAL\b/.test(words.join(' ')); // SET SESSION 允许
  }
  if (leader === 'START' || leader === 'BEGIN' || leader === 'COMMIT' || leader === 'ROLLBACK') return true;
  return false;
}

// ---------- 预览影响行数：UPDATE/DELETE → SELECT COUNT(*) ----------
export function buildCountPreview(stmtSql) {
  const m = /^\s*(?:DELETE\s+FROM|UPDATE)\s+((?:`[^`]+`|[A-Za-z0-9_$.]+))/i.exec(stmtSql);
  if (!m) return null;
  const table = m[1];
  const whereIdx = searchKeyword(stmtSql, /\bWHERE\b/i);
  if (whereIdx < 0) return { table, where: null };
  const where = stmtSql.slice(whereIdx).replace(/;\s*$/, '');
  return { table, where, sql: `SELECT COUNT(*) AS affected_rows FROM ${table} ${where}` };
}

function searchKeyword(sql, re) {
  // 只在字符串/注释外找第一个 WHERE
  for (const tk of tokenize(sql)) {
    if (tk.t === 'word' && re.test(tk.v)) return tk.start;
  }
  return -1;
}

// ---------- 编辑器高亮用的危险词表 ----------
export const DANGER_WORDS = {
  // 红：出现即标红
  high: ['DROP', 'TRUNCATE', 'SHUTDOWN', 'GRANT', 'REVOKE'],
  // 黄：写操作相关
  medium: ['INSERT', 'REPLACE', 'UPDATE', 'DELETE', 'ALTER', 'CREATE', 'RENAME', 'KILL', 'FLUSH', 'RESET', 'LOCK', 'UNLOCK', 'LOAD']
};
