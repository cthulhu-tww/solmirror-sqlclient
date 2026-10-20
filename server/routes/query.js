import { Router } from 'express';
import { runOnConn, normalizeRows, httpError, translateDbError } from '../lib/mysql.js';
import { getConnection } from '../lib/store.js';

const r = Router();

const DEFAULT_MAX_ROWS = 500;
const HARD_CAP = 5000;

r.post('/', async (req, res) => {
  const { connId, sql, maxRows } = req.body || {};
  if (!connId) throw httpError(400, '缺少连接 ID');
  if (!sql || !sql.trim()) throw httpError(400, 'SQL 为空');
  const cfg = getConnection(connId);
  if (!cfg) throw httpError(404, '连接配置不存在');

  const limit = Math.min(Number(maxRows) || DEFAULT_MAX_ROWS, HARD_CAP);
  const started = Date.now();
  try {
    const result = await runOnConn(connId, conn => conn.query(sql));
    const durationMs = Date.now() - started;

    // SELECT / SHOW / DESC 返回数组；INSERT/UPDATE/DELETE 返回 OkPacket
    if (Array.isArray(result[0])) {
      const all = normalizeRows(result[0]);
      const columns = all.length ? Object.keys(all[0]) : deriveColumns(result[1]);
      const rows = all.slice(0, limit);
      res.json({
        kind: 'rows', columns, rows,
        total: all.length, returned: rows.length,
        truncated: all.length > limit, durationMs
      });
    } else {
      const ok = result[0];
      res.json({
        kind: 'affected',
        affectedRows: ok.affectedRows ?? 0,
        insertId: ok.insertId ?? 0,
        info: ok.info || '',
        durationMs
      });
    }
  } catch (err) {
    const t = translateDbError(err);
    res.status(400).json({ error: t.raw, hint: t.hint || '', errno: t.errno, sqlMessage: err.sqlMessage || '' });
  }
});

function deriveColumns(fields) {
  return (fields || []).map(f => f.name);
}

export default r;
