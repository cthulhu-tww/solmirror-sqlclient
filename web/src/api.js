// API 封装：统一错误结构 { error, hint, errno }
// APK 原生环境：WebView 页面(origin localhost) 访问内嵌 Node 网关需绝对地址；
// 网关随 App 启动有冷启动延迟，网络层错误自动重试。
const NATIVE = typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();
const BASE = NATIVE ? 'http://127.0.0.1:9410' : '';

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function once(method, url, body) {
  const res = await fetch(BASE + url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null;
  try { data = await res.json(); } catch { /* 非 JSON */ }
  if (!res.ok) {
    const err = new Error(data?.error || `请求失败 (${res.status})`);
    err.hint = data?.hint || '';
    err.errno = data?.errno;
    err.sqlMessage = data?.sqlMessage || '';
    throw err;
  }
  return data;
}

async function req(method, url, body) {
  if (!NATIVE) return once(method, url, body);
  // 原生环境：网关可能还在冷启动，网络错误（TypeError）时退避重试
  for (let i = 0; i < 20; i++) {
    try {
      return await once(method, url, body);
    } catch (e) {
      if (e instanceof TypeError && i < 19) {
        await sleep(400 + i * 150);
        continue;
      }
      throw e;
    }
  }
}

export const api = {
  listConnections: () => req('GET', '/api/connections'),
  saveConnection: (c) => req('POST', '/api/connections', c),
  deleteConnection: (id) => req('DELETE', `/api/connections/${id}`),
  testConnection: (c) => req('POST', '/api/connections/test', c),
  touch: (id) => req('POST', `/api/connections/${id}/touch`, {}),

  databases: (id) => req('GET', `/api/connections/${id}/databases`),
  useDb: (id, db) => req('POST', `/api/connections/${id}/use`, { db }),
  tables: (id, db) => req('GET', `/api/connections/${id}/tables?db=${encodeURIComponent(db)}`),
  columns: (id, db, table) => req('GET', `/api/connections/${id}/columns?db=${encodeURIComponent(db)}&table=${encodeURIComponent(table)}`),
  ddl: (id, db, table) => req('GET', `/api/connections/${id}/ddl?db=${encodeURIComponent(db)}&table=${encodeURIComponent(table)}`),
  columnsAll: (id, db) => req('GET', `/api/connections/${id}/columnsAll?db=${encodeURIComponent(db)}`),

  query: (connId, sql, maxRows) => req('POST', '/api/query', { connId, sql, maxRows })
};
