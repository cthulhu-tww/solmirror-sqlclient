// 把网关(esbuild 单文件 CJS) 打进 dist/nodejs/，随 Capacitor webDir 一起打进 APK
// 主入口 index.js 在运行时探测 nodejs-mobile 的 bridge 模块以获取 App 数据目录
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const outDir = path.join(root, 'dist', 'nodejs');

fs.mkdirSync(outDir, { recursive: true });

await build({
  entryPoints: [path.join(root, 'server', 'index.js')],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  outfile: path.join(outDir, 'server-bundle.cjs'),
  minify: true,
  legalComments: 'none',
  logLevel: 'info'
});

fs.writeFileSync(
  path.join(outDir, 'package.json'),
  JSON.stringify({ name: 'solsql-gateway', version: '0.1.0', main: 'index.js' }, null, 2)
);

// 主入口：nodejs-mobile 环境存在 'bridge' 模块（保持 external），桌面环境没有则走默认 data/
fs.writeFileSync(
  path.join(outDir, 'index.js'),
  `try {
  const { app } = require('bridge');
  if (app && typeof app.datadir === 'function') process.env.SOL_DATA_DIR = app.datadir();
} catch {}
require('./server-bundle.cjs');
`
);

console.log('[build-mobile] 网关已打包到 dist/nodejs/');
