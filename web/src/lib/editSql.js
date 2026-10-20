// 结果集编辑引擎：纯函数、无 DOM 依赖。
// 职责：① 判断一条 SELECT 是否「单表简单查询」（结果行能用主键唯一定位）；
//       ② 按主键把单元格修改生成安全的 UPDATE 语句。
// 复用 sqlDanger 的分词器，保证字符串/注释里的关键词不误判。

import { tokenize } from './sqlDanger.js';

// ---------- 识别可编辑目标 ----------
// 返回 { table, quoted } | null。仅支持：单表 SELECT（可带 WHERE/ORDER/LIMIT/别名），
// 排除：JOIN、逗号多表、子查询、UNION、GROUP BY/HAVING、DISTINCT、聚合函数、FOR UPDATE。
export function detectEditTarget(sql) {
  if (!sql) return null;
  const toks = tokenize(sql).filter(t => t.t !== 'ws' && t.t !== 'comment');
  if (!toks.length) return null;
  const upper = t => (t.t === 'word' ? t.v.toUpperCase() : t.v);

  if (upper(toks[0]) !== 'SELECT') return null;

  // 顶层找 FROM（跳过括号内的）
  let depth = 0, fromIdx = -1;
  for (let i = 1; i < toks.length; i++) {
    const v = toks[i].v;
    if (v === '(') { depth++; continue; }
    if (v === ')') { depth--; continue; }
    if (depth === 0 && toks[i].t === 'word' && upper(toks[i]) === 'FROM') { fromIdx = i; break; }
  }
  if (fromIdx < 0) return null;

  // SELECT 列表里出现函数/表达式/括号 → 结果列可能不是真实列，拒绝
  for (let i = 1; i < fromIdx; i++) {
    if (toks[i].v === '(') return null;
    if (toks[i].t === 'word' && upper(toks[i]) === 'DISTINCT') return null;
  }

  // FROM 后取表名：只读「表名」或「库名.表名」两段，后面的词（别名/WHERE 等）不属于表名
  let j = fromIdx + 1;
  const first = toks[j];
  if (!first || (first.t !== 'word' && first.t !== 'ident')) return null;
  const parts = [first.v.replace(/`/g, '')];
  j++;
  if (toks[j] && toks[j].v === '.') {
    const second = toks[j + 1];
    if (!second || (second.t !== 'word' && second.t !== 'ident')) return null;
    parts.push(second.v.replace(/`/g, ''));
    j += 2;
  }

  // 表名之后到语句结束：不允许 JOIN/UNION/GROUP/HAVING/WINDOW/FOR UPDATE/逗号/括号/三段名
  const rest = toks.slice(j);
  if (rest[0] && rest[0].v === '.') return null;
  const badWords = ['JOIN', 'STRAIGHT_JOIN', 'UNION', 'GROUP', 'HAVING', 'WINDOW', 'FOR', 'NATURAL', 'CROSS'];
  for (const tk of rest) {
    if (tk.v === ',' || tk.v === '(') return null;
    if (tk.t === 'word' && badWords.includes(upper(tk))) return null;
  }

  return { table: parts[parts.length - 1], quoted: parts.map(p => quoteIdent(p)).join('.') };
}

// ---------- SQL 值/标识符转义 ----------
export function quoteIdent(name) {
  return '`' + String(name).replace(/`/g, '``') + '`';
}

// 原始值（来自查询结果）转 SQL 字面量：数字原样，字符串加引号并转义 \ 和 '
export function sqlValue(v) {
  if (v === null) return 'NULL';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'bigint') return v.toString();
  const s = String(v);
  return "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}

// 用户输入的值（textarea 字符串，或 null=置 NULL）：一律按字符串加引号，
// MySQL 会对数值/日期列做隐式转换；NULL 用关键字。
export function sqlInputValue(v) {
  if (v === null) return 'NULL';
  return sqlValue(String(v));
}

// ---------- 生成 UPDATE ----------
// sets:  [{ col, value }]          value: string | null（null=置 NULL）
// where: [{ col, value }]          value 用原始行值（主键定位）
// 返回 UPDATE 语句字符串
export function buildUpdateSql({ quoted, sets, where }) {
  const setPart = sets.map(s => `${quoteIdent(s.col)} = ${sqlInputValue(s.value)}`).join(', ');
  const wherePart = where.map(w => `${quoteIdent(w.col)} = ${sqlValue(w.value)}`).join(' AND ');
  return `UPDATE ${quoted} SET ${setPart} WHERE ${wherePart}`;
}
