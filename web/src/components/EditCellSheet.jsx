import { useState } from 'react';
import Sheet from './Sheet.jsx';

// 单元格编辑弹层：看原值 → 输入新值 / 置 NULL → 保存（只记录，应用时才真正执行 UPDATE）
// current: 已有修改 { v, isNull } | undefined（首次编辑）
export default function EditCellSheet({ column, table, colType, original, current, onSave, onClose }) {
  const [v, setV] = useState(current ? current.v : (original === null || original === undefined ? '' : String(original)));
  const [asNull, setAsNull] = useState(current ? current.isNull : original === null);

  const isBlob = original && typeof original === 'object' && original.__blob;
  const origText = original === null ? 'NULL' : isBlob ? `[BLOB ${original.size}B]` : String(original);

  return (
    <Sheet title={`修改 · ${column}`} onClose={onClose}>
      <div className="mut small" style={{ marginBottom: 6 }}>
        表 <b>{table}</b>{colType ? ` · ${colType}` : ''}
      </div>
      <div className="mut small" style={{ marginBottom: 4 }}>原值</div>
      <div className="cellview" style={{ maxHeight: '16dvh', marginBottom: 10 }}>{origText}</div>

      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
        <span className="mut small">新值</span>
        <button
          className={`btn sm ${asNull ? '' : 'ghost'}`}
          style={asNull ? { background: 'var(--warn-bg)', color: 'var(--warn)', borderColor: 'transparent' } : {}}
          onClick={() => setAsNull(!asNull)}
        >
          置 NULL{asNull ? ' ✓' : ''}
        </button>
      </div>
      <textarea
        className="input cellinput"
        rows={4}
        value={asNull ? '' : v}
        disabled={asNull}
        placeholder={asNull ? '（已设为 NULL）' : '输入新的字段值'}
        onChange={e => setV(e.target.value)}
      />

      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn grow" onClick={onClose}>取消</button>
        <button
          className="btn primary grow"
          disabled={asNull && original === null}
          onClick={() => onSave(asNull ? null : v)}
        >
          保存修改
        </button>
      </div>
      <div className="mut small" style={{ marginTop: 8 }}>修改先记录在表格里（黄底标记），点结果区上方的「应用」才真正执行 UPDATE</div>
    </Sheet>
  );
}
