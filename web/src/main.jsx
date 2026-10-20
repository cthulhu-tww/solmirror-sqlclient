import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// 安卓返回键：先关弹层 → 页面后退 → 退出 App（仅原生环境）
if (window.Capacitor?.isNativePlatform?.()) {
  import('@capacitor/app').then(({ App }) => {
    App.addListener('backButton', () => {
      const sheets = document.querySelectorAll('.sheetmask');
      const sheet = sheets[sheets.length - 1];
      if (sheet) {
        sheet.dispatchEvent(new MouseEvent('mousedown'));
        return;
      }
      if (window.location.pathname !== '/') {
        window.history.back();
        return;
      }
      App.exitApp();
    });
  }).catch(() => {});
}
