import mysql from 'mysql2/promise';
import { getConnectionWithPassword } from './store.js';

// 每个连接配置使用单条 MySQL 连接（保证 USE / SET SESSION 会话状态一致），
// 外面套一个串行队列，避免并发查询互相打断。
const conns = new Map(); // connId -> { conn, queue: Promise, cfg }

async function createConn(cfg) {
  const conn = await mysql.createConnection({
    host: cfg.host,
    port: Number(cfg.port) || 3306,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database || undefined,
    charset: 'utf8mb4',
    dateStrings: true,          // 日期保持字符串，避免时区偏移
    bigNumberStrings: true,     // BIGINT 安全
    supportBigNumbers: true,
    multipleStatements: false,  // 服务端兜底：一次只允许一条语句
    connectTimeout: 10_000
  });
  return conn;
}

export async function getConn(connId) {
  let entry = conns.get(connId);
  if (entry && entry.broken) {
    conns.delete(connId);
    entry = undefined;
  }
  if (!entry) {
    const cfg = getConnectionWithPassword(connId);
    if (!cfg) throw httpError(404, '连接配置不存在，可能已被删除');
    const conn = await createConn(cfg);
    entry = { conn, queue: Promise.resolve() };
    conns.set(connId, entry);
    conn.on('error', () => { entry.broken = true; });
  }
  return entry;
}

export function httpError(status, message, extra = {}) {
  const err = new Error(message);
  err.status = status;
  Object.assign(err, extra);
  return err;
}

// 序列化执行：同一连接上的查询排队，防止 "Can't add new command when connection is in closed state" 类并发问题
export async function runOnConn(connId, fn) {
  const entry = await getConn(connId);
  const job = entry.queue.then(() => fn(entry.conn));
  // 队列头始终吞掉错误，保证后续任务能继续；真正的错误抛给调用方
  entry.queue = job.catch(() => {});
  return job;
}

// 把 mysql2 返回的行对象里的 Buffer 转成可传输的结构
function normalizeValue(v) {
  if (v === null || v === undefined) return null;
  if (Buffer.isBuffer(v)) {
    return { __blob: true, size: v.length, b64: v.toString('base64') };
  }
  if (typeof v === 'object') return String(v); // 极少数驱动对象，降级为字符串
  return v;
}

export function normalizeRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map(r => {
    const out = {};
    for (const [k, val] of Object.entries(r)) out[k] = normalizeValue(val);
    return out;
  });
}

export async function testConnection(cfg) {
  const conn = await mysql.createConnection({
    host: cfg.host,
    port: Number(cfg.port) || 3306,
    user: cfg.user,
    password: cfg.password || '',
    database: cfg.database || undefined,
    charset: 'utf8mb4',
    connectTimeout: 8_000
  });
  const [ver] = await conn.query('SELECT @@version AS v').then(r => r[0]);
  await conn.end();
  return { version: Array.isArray(ver) ? ver[0]?.v : ver?.v };
}

export function translateDbError(err) {
  const out = { raw: err && err.message ? err.message : String(err) };
  if (err && err.code === 'ECONNREFUSED') {
    out.hint = '连接被拒绝：检查主机地址和端口是否正确、MySQL 是否在运行、防火墙/安全组是否放行';
  } else if (err && err.code === 'ETIMEDOUT') {
    out.hint = '连接超时：网络不可达或被防火墙静默丢弃，检查白名单/VPN';
  } else if (err && err.code === 'ENOTFOUND') {
    out.hint = '域名解析失败：检查主机名拼写';
  } else if (err && err.code === 'ER_ACCESS_DENIED_ERROR') {
    out.hint = '账号或密码错误，或该账号不允许从当前 IP 登录（检查 user 表 host 限制）';
  } else if (err && err.code === 'ER_HOST_NOT_PRIVILEGED') {
    out.hint = '当前 IP 不在 MySQL 允许的主机列表中';
  } else if (err && err.code === 'ER_TOO_MANY_CONNECTIONS') {
    out.hint = '数据库连接数已满（1040）';
  } else if (err && err.code === 'ER_ACCESS_DENIED_NO_PASSWORD_ERROR') {
    out.hint = '需要密码但未提供密码';
  }
  if (err && err.errno) out.errno = err.errno;
  return out;
}
