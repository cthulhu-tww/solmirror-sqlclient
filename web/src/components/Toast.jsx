import { createRoot } from 'react-dom/client';

// 轻量 Toast：命令式调用 toast('已复制')
let wrap = null;
function ensure() {
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.className = 'toastwrap';
    document.body.appendChild(wrap);
  }
  return wrap;
}

export function toast(msg, type = '') {
  const host = ensure();
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  host.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .25s, transform .25s';
    el.style.opacity = '0';
    el.style.transform = 'translateY(-8px)';
    setTimeout(() => el.remove(), 260);
  }, 2200);
}
