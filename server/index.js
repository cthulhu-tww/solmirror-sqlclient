import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import connectionsRoute from './routes/connections.js';
import schemaRoute from './routes/schema.js';
import queryRoute from './routes/query.js';

// ESM 开发态用 import.meta.url，esbuild CJS 打包态用 __dirname
const baseDir = typeof __dirname !== 'undefined'
  ? __dirname
  : path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 9410;
const HOST = process.env.HOST || '127.0.0.1';

const app = express();
app.use(express.json({ limit: '2mb' }));

// CORS：APK 内 WebView(origin localhost) 访问本网关(127.0.0.1:port) 属跨源，需放行
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use('/api/connections', connectionsRoute);
app.use('/api/connections', schemaRoute);
app.use('/api/query', queryRoute);

// 前端构建产物（生产模式）；开发模式由 vite 代理 /api 过来
const dist = path.join(baseDir, '..', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

// 统一错误出口
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || '服务器内部错误' });
});

app.listen(PORT, HOST, () => {
  console.log(`[solsql] API + UI 已启动: http://${HOST}:${PORT}`);
  if (HOST !== '127.0.0.1') {
    console.log(`[solsql] 局域网模式：手机访问本机局域网 IP:${PORT} 即可使用`);
  }
});
