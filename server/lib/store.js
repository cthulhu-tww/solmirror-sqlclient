import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

// ESM 开发态用 import.meta.url，esbuild CJS 打包态用 __dirname
const baseDir = typeof __dirname !== 'undefined'
  ? __dirname
  : path.dirname(fileURLToPath(import.meta.url));
// SOL_DATA_DIR：APK 内嵌运行时由入口指向 App 私有数据目录
const DATA_DIR = process.env.SOL_DATA_DIR || path.join(baseDir, '..', 'data');
const CONN_FILE = path.join(DATA_DIR, 'connections.json');
const KEY_FILE = path.join(DATA_DIR, '.key');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 本机密钥：首次生成，用于加密连接密码。密钥丢失则已存密码失效。
function loadKey() {
  ensureDir();
  if (!fs.existsSync(KEY_FILE)) {
    fs.writeFileSync(KEY_FILE, crypto.randomBytes(32));
  }
  return fs.readFileSync(KEY_FILE);
}

export function encrypt(plain) {
  const key = loadKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, enc].map(b => b.toString('base64')).join('.');
}

export function decrypt(payload) {
  try {
    const [ivB, tagB, encB] = payload.split('.');
    const key = loadKey();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(encB, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}

function readAll() {
  ensureDir();
  if (!fs.existsSync(CONN_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(CONN_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writeAll(list) {
  ensureDir();
  fs.writeFileSync(CONN_FILE, JSON.stringify(list, null, 2), 'utf8');
}

export function listConnections() {
  // 永不返回密码密文以外的敏感字段
  return readAll().map(({ pw, ...rest }) => ({ ...rest, hasPassword: Boolean(pw) }))
    .sort((a, b) => (b.lastUsedAt || 0) - (a.lastUsedAt || 0));
}

export function getConnection(id) {
  return readAll().find(c => c.id === id) || null;
}

export function getConnectionWithPassword(id) {
  const c = readAll().find(c => c.id === id);
  if (!c) return null;
  return { ...c, password: c.pw ? decrypt(c.pw) : '' };
}

export function saveConnection(input) {
  const list = readAll();
  let item;
  if (input.id) {
    item = list.find(c => c.id === input.id);
    if (!item) return null;
    Object.assign(item, {
      name: input.name,
      host: input.host,
      port: input.port || 3306,
      user: input.user,
      database: input.database || '',
      env: input.env || 'dev',
      note: input.note || '',
      updatedAt: Date.now()
    });
    // 编辑时密码留空 = 保持原密码
    if (input.password) item.pw = encrypt(input.password);
  } else {
    item = {
      id: crypto.randomUUID(),
      name: input.name,
      host: input.host,
      port: input.port || 3306,
      user: input.user,
      database: input.database || '',
      env: input.env || 'dev',
      note: input.note || '',
      pw: input.password ? encrypt(input.password) : '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastUsedAt: 0
    };
    list.push(item);
  }
  writeAll(list);
  const { pw, ...safe } = item;
  return { ...safe, hasPassword: Boolean(pw) };
}

export function deleteConnection(id) {
  const list = readAll();
  const next = list.filter(c => c.id !== id);
  if (next.length === list.length) return false;
  writeAll(next);
  return true;
}

export function touchConnection(id) {
  const list = readAll();
  const item = list.find(c => c.id === id);
  if (item) {
    item.lastUsedAt = Date.now();
    writeAll(list);
  }
}
