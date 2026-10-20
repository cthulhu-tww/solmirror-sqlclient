import { useMemo, useState } from 'react';
import Sheet from './Sheet.jsx';
import { copyText } from '../store.js';
import { toast } from './Toast.jsx';
import { IconCopy } from './Icons.jsx';

// 单元格详情查看：长文本 / JSON / BLOB；可编辑列提供「修改此值」入口
export default function CellViewer({ column, value, rowIndex, row, onEdit, onClose }) {
  const isBlob = value && typeof value === 'object' && value.__blob;
  const [asHex, setAsHex] = useState(false);
  const raw = value === null ? 'NULL' : String(value);

  const display = useMemo(() => {
    if (value === null) return { text: 'NULL', note: '空值（NULL）' };
    if (isBlob) {
      const buf = Buffer_like(value.b64);
      if (asHex) {
        const hex = Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join(' ');
        return { text: hex, note: `HEX 视图 · ${value.size} 字节` };
      }
      const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(buf);
      const printable = utf8.replace(/\uFFFD/g, '');
      const looksText = printable.length >= value.size * 0.7;
      return { text: looksText ? utf8 : '（二进制内容，切换 HEX 查看）', note: `BLOB · ${value.size} 字节` };
    }
    const s = String(value);
    if (/^[\[{][\s\S]*[\]}]$/.test(s.trim())) {
      try { return { text: JSON.stringify(JSON.parse(s), null, 2), note: 'JSON · 已格式化' }; } catch { /* 非 JSON */ }
    }
    return { text: s, note: `${s.length} 字符` };
  }, [value, isBlob, asHex]);

  const copyRow = () => {
    const tsv = Object.entries(row).map(([k, v]) => `${k}\t${v === null ? 'NULL' : typeof v === 'object' ? '[BLOB]' : v}`).join('\n');
    copyText(tsv).then(() => toast('整行已复制（列名:值）', 'ok'));
  };

  return (
    <Sheet title={`第 ${rowIndex + 1} 行 · ${column}`} onClose={onClose}>
      <div className="row" style={{ marginBottom: 8 }}>
        <span className="chisk gray">{display.note}</span>
        {isBlob && (
          <button className="btn sm" onClick={() => setAsHex(!asHex)}>{asHex ? '看文本' : '看 HEX'}</button>
        )}
      </div>
      <div className="cellview">{display.text}</div>
      {onEdit && (
        <button className="btn primary" style={{ width: '100%', marginTop: 10 }} onClick={onEdit}>
          ✏️ 修改此值
        </button>
      )}
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn grow" onClick={() => copyText(isBlob ? raw : raw).then(() => toast('已复制', 'ok'))}>
          <IconCopy width={15} height={15} /> 复制值
        </button>
        {row && <button className="btn grow" onClick={copyRow}><IconCopy width={15} height={15} /> 复制整行</button>}
      </div>
    </Sheet>
  );
}

// base64 → Uint8Array（浏览器）
function Buffer_like(b64) {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}
