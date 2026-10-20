import { Router } from 'express';
import {
  listConnections, saveConnection, deleteConnection,
  getConnectionWithPassword, touchConnection
} from '../lib/store.js';
import { testConnection, translateDbError, httpError } from '../lib/mysql.js';

const r = Router();

r.get('/', (req, res) => res.json(listConnections()));

r.post('/', (req, res) => {
  const { name, host, user } = req.body || {};
  if (!name || !host || !user) throw httpError(400, '名称、主机、用户名必填');
  const saved = saveConnection(req.body);
  res.json(saved);
});

r.delete('/:id', (req, res) => {
  const ok = deleteConnection(req.params.id);
  if (!ok) throw httpError(404, '连接不存在');
  res.json({ ok: true });
});

// 连通性测试：支持两种用法 —— 传入完整表单（保存前测试）或已保存连接 id
r.post('/test', async (req, res) => {
  try {
    let cfg = req.body;
    if (cfg.id && !cfg.host) {
      cfg = getConnectionWithPassword(cfg.id);
      if (!cfg) throw httpError(404, '连接不存在');
    }
    if (!cfg.host || !cfg.user) throw httpError(400, '主机和用户名必填');
    const info = await testConnection(cfg);
    res.json({ ok: true, ...info });
  } catch (err) {
    res.json({ ok: false, ...translateDbError(err) });
  }
});

r.post('/:id/touch', (req, res) => {
  touchConnection(req.params.id);
  res.json({ ok: true });
});

export default r;
