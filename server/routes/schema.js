import { Router } from 'express';
import { runOnConn, normalizeRows, httpError } from '../lib/mysql.js';

const r = Router();

// 数据库列表（含当前库）
r.get('/:id/databases', async (req, res) => {
  const rows = await runOnConn(req.params.id, conn =>
    conn.query(`SHOW DATABASES`)
  );
  const names = normalizeRows(rows[0]).map(r => Object.values(r)[0]);
  const cur = await runOnConn(req.params.id, conn =>
    conn.query(`SELECT DATABASE() AS db`)
  );
  res.json({ databases: names, current: normalizeRows(cur[0])[0]?.db || null });
});

// 切换当前数据库（USE），返回切换后的库名与表列表
r.post('/:id/use', async (req, res) => {
  const db = (req.body?.db || '').replace(/`/g, '``');
  if (!db) throw httpError(400, '缺少数据库名');
  await runOnConn(req.params.id, conn => conn.query('USE ??', [db]));
  res.json({ ok: true, current: db });
});

// 指定库的表列表（名称 + 注释 + 估算行数）
r.get('/:id/tables', async (req, res) => {
  const db = req.query.db;
  if (!db) throw httpError(400, '缺少 db 参数');
  const rows = await runOnConn(req.params.id, conn =>
    conn.query(
      `SELECT TABLE_NAME AS name, TABLE_COMMENT AS comment, TABLE_ROWS AS rowsEst, TABLE_TYPE AS type
       FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME`,
      [db]
    )
  );
  res.json({ tables: normalizeRows(rows[0]) });
});

// 表结构
r.get('/:id/columns', async (req, res) => {
  const { db, table } = req.query;
  if (!db || !table) throw httpError(400, '缺少 db/table 参数');
  const rows = await runOnConn(req.params.id, conn =>
    conn.query(
      `SELECT COLUMN_NAME AS name, COLUMN_TYPE AS type, IS_NULLABLE AS nullable, COLUMN_KEY AS keyKind,
              COLUMN_DEFAULT AS def, EXTRA AS extra, COLUMN_COMMENT AS comment
       FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
       ORDER BY ORDINAL_POSITION`,
      [db, table]
    )
  );
  const idx = await runOnConn(req.params.id, conn =>
    conn.query(
      `SELECT INDEX_NAME AS name, COLUMN_NAME AS column_name, NON_UNIQUE AS nonUnique, SEQ_IN_INDEX AS seq
       FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
       ORDER BY INDEX_NAME, SEQ_IN_INDEX`,
      [db, table]
    )
  );
  res.json({ columns: normalizeRows(rows[0]), indexes: normalizeRows(idx[0]) });
});

// 建表语句
r.get('/:id/ddl', async (req, res) => {
  const { db, table } = req.query;
  if (!db || !table) throw httpError(400, '缺少 db/table 参数');
  const rows = await runOnConn(req.params.id, conn =>
    conn.query('SHOW CREATE TABLE ?.?', [db, table])
  );
  const row = normalizeRows(rows[0])[0] || {};
  res.json({ ddl: row['Create Table'] || '' });
});

// 整库列信息（一次拉取，供编辑器自动补全 + 结果集编辑定位主键）：
// { columns: { table: [col] }, pri: { table: [pk列] }, types: { table: { col: 类型 } } }
r.get('/:id/columnsAll', async (req, res) => {
  const db = req.query.db;
  if (!db) throw httpError(400, '缺少 db 参数');
  const rows = await runOnConn(req.params.id, conn =>
    conn.query(
      `SELECT TABLE_NAME AS t, COLUMN_NAME AS c, COLUMN_KEY AS k, COLUMN_TYPE AS ct
       FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ?
       ORDER BY TABLE_NAME, ORDINAL_POSITION`,
      [db]
    )
  );
  const columns = {}, pri = {}, types = {};
  for (const r of normalizeRows(rows[0])) {
    (columns[r.t] = columns[r.t] || []).push(r.c);
    if (r.k === 'PRI') (pri[r.t] = pri[r.t] || []).push(r.c);
    (types[r.t] = types[r.t] || {})[r.c] = r.ct;
  }
  res.json({ columns, pri, types });
});

export default r;
