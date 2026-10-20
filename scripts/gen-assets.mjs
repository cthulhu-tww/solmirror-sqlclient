// 生成 App 图标与启动图（纯 Node PNG 编码：RGBA → zlib → IHDR/IDAT/IEND）
// 产物：assets/icon.png (1024²) 与 assets/splash.png (2732²)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'assets');
fs.mkdirSync(outDir, { recursive: true });

// ---- PNG 编码 ----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePNG(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: None
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

// ---- 绘制工具 ----
const hex = s => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
const GRAD_A = hex('#4f7df9'), GRAD_B = hex('#22d3ee');

function lerp(a, b, t) { return a + (b - a) * t; }
// 对角渐变
function gradAt(t) {
  return [lerp(GRAD_A[0], GRAD_B[0], t) | 0, lerp(GRAD_A[1], GRAD_B[1], t) | 0, lerp(GRAD_A[2], GRAD_B[2], t) | 0];
}
// 闪电多边形（归一化 0..1 坐标）
const BOLT = [
  [0.625, 0.055], [0.275, 0.545], [0.470, 0.545],
  [0.375, 0.945], [0.745, 0.415], [0.540, 0.415], [0.705, 0.055]
];
function inPoly(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function boltAlpha(nx, ny) {
  // 2x2 子采样抗锯齿
  let hit = 0;
  for (const [ox, oy] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
    if (inPoly(nx + ox / 1024, ny + oy / 1024, BOLT)) hit++;
  }
  return hit / 4;
}
function roundedAlpha(nx, ny, r) {
  const x = Math.abs(nx - 0.5), y = Math.abs(ny - 0.5);
  const half = 0.5 - r;
  const dx = Math.max(0, x - half), dy = Math.max(0, y - half);
  const d = Math.sqrt(dx * dx + dy * dy);
  return d <= r ? 1 : 0;
}

// ---- 图标：渐变圆角方块 + 白色闪电 ----
function makeIcon(size) {
  const px = Buffer.alloc(size * size * 4);
  const R = size * 0.08; // 圆角半径（Android 会再裁剪，保留直一点的角）
  const boltScale = 0.62, boltOff = (1 - boltScale) / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const nx = x / size, ny = y / size;
      const bgA = roundedAlpha(nx, ny, R / size);
      const g = gradAt((nx + ny) / 2);
      const bA = boltAlpha((nx - boltOff) / boltScale, (ny - boltOff) / boltScale);
      // 白色闪电盖在渐变上
      const c = [lerp(g[0], 255, bA) | 0, lerp(g[1], 255, bA) | 0, lerp(g[2], 255, bA) | 0];
      px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = (bgA * 255) | 0;
    }
  }
  return encodePNG(size, size, px);
}

// ---- 启动图：深色底 + 居中渐变闪电 ----
function makeSplash(size) {
  const px = Buffer.alloc(size * size * 4);
  const BG = hex('#0b0e14');
  const boltScale = 0.30, boltOff = (1 - boltScale) / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const nx = x / size, ny = y / size;
      const bA = boltAlpha((nx - boltOff) / boltScale, (ny - boltOff) / boltScale);
      const g = gradAt((nx + ny) / 2);
      px[i] = lerp(BG[0], g[0], bA) | 0;
      px[i + 1] = lerp(BG[1], g[1], bA) | 0;
      px[i + 2] = lerp(BG[2], g[2], bA) | 0;
      px[i + 3] = 255;
    }
  }
  return encodePNG(size, size, px);
}

fs.writeFileSync(path.join(outDir, 'icon.png'), makeIcon(1024));
fs.writeFileSync(path.join(outDir, 'splash.png'), makeSplash(2732));
console.log('[gen-assets] assets/icon.png + assets/splash.png 已生成');
