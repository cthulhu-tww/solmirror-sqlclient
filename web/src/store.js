import { create } from 'zustand';
import { api } from './api.js';

const LS = {
  theme: 'solsql.theme', safe: 'solsql.safeMode', rows: 'solsql.maxRows',
  hist: 'solsql.history', fav: 'solsql.favorites', draft: 'solsql.draft',
  lastConn: 'solsql.lastConn'
};
const readJSON = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const writeJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 满 */ } };

// crypto.randomUUID 仅在安全上下文（https/localhost）可用；手机经 http://局域网IP 访问时兜底
export function uuid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return 'xx-xx-4xx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16)) + Date.now().toString(16);
}

export const ENV_LABELS = { prod: '生产', staging: '预发', dev: '测试', local: '本地' };

export const useApp = create((set, get) => ({
  // ---- 持久化偏好 ----
  theme: localStorage.getItem(LS.theme) || 'dark',
  safeMode: localStorage.getItem(LS.safe) !== '0',
  maxRows: Number(localStorage.getItem(LS.rows)) || 500,

  // ---- 会话状态 ----
  connections: [],
  activeConn: null,   // { id, name, env, host, user, database ... }
  currentDb: null,
  pendingSql: null,   // 待载入编辑器的 SQL（从历史/收藏进来）
  running: false,

  // ---- 数据 ----
  history: readJSON(LS.hist, []),
  favorites: readJSON(LS.fav, []),

  setTheme(t) {
    localStorage.setItem(LS.theme, t);
    document.documentElement.dataset.theme = t;
    set({ theme: t });
  },
  toggleSafe(v) {
    const nv = v ?? !get().safeMode;
    localStorage.setItem(LS.safe, nv ? '1' : '0');
    set({ safeMode: nv });
  },
  setMaxRows(n) {
    localStorage.setItem(LS.rows, String(n));
    set({ maxRows: n });
  },

  async refreshConnections() {
    const list = await api.listConnections();
    set({ connections: list });
    // 恢复上次使用的连接
    const lastId = localStorage.getItem(LS.lastConn);
    if (!get().activeConn && lastId) {
      const c = list.find(x => x.id === lastId);
      if (c) set({ activeConn: c, currentDb: c.database || null });
    }
    return list;
  },
  setActiveConn(c) {
    localStorage.setItem(LS.lastConn, c.id);
    set({ activeConn: c, currentDb: c.database || null });
    api.touch(c.id).catch(() => {});
  },
  setCurrentDb(db) { set({ currentDb: db }); },
  setPendingSql(sql) { set({ pendingSql: sql }); },

  // ---- 历史与收藏 ----
  addHistory(entry) {
    const list = [{ id: uuid(), at: Date.now(), ...entry }, ...get().history];
    set({ history: list.slice(0, 300) });
    writeJSON(LS.hist, get().history);
  },
  clearHistory() { set({ history: [] }); writeJSON(LS.hist, []); },
  isFavorited(sql) { return get().favorites.some(f => f.sql === sql); },
  addFavorite(sql, name) {
    if (get().favorites.some(f => f.sql === sql)) return false;
    const list = [...get().favorites, { id: uuid(), name: name || sql.slice(0, 40), sql }];
    set({ favorites: list });
    writeJSON(LS.fav, list);
    return true;
  },
  removeFavorite(id) {
    const list = get().favorites.filter(f => f.id !== id);
    set({ favorites: list });
    writeJSON(LS.fav, list);
  },
  setRunning(v) { set({ running: v }); },

  // 草稿
  saveDraft(sql) { localStorage.setItem(LS.draft, sql); },
  loadDraft() { return localStorage.getItem(LS.draft) || ''; }
}));

// ---- 工具 ----
export function fmtMs(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${Math.floor(ms / 60000)}m${Math.round((ms % 60000) / 1000)}s`;
}

export function fmtTime(ts) {
  const d = new Date(ts);
  const p = n => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      return true;
    } catch { return false; }
  }
}
