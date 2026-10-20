import { useEffect } from 'react';
import { IconClose } from './Icons.jsx';

// 通用底部弹层：标题 + 关闭，内容自定义
export default function Sheet({ title, onClose, children, closeOnMask = true }) {
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="sheetmask" onMouseDown={e => { if (closeOnMask && e.target === e.currentTarget) onClose?.(); }}>
      <div className="sheet">
        <div className="grab" />
        {title !== null && (
          <h3>
            {title}
            <button className="closex" onClick={onClose} aria-label="关闭"><IconClose width={18} height={18} /></button>
          </h3>
        )}
        {children}
      </div>
    </div>
  );
}
