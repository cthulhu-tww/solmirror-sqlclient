import { useApp, ENV_LABELS } from '../store.js';
import { toast } from '../components/Toast.jsx';
import { IconShield } from '../components/Icons.jsx';

export default function SettingsPage() {
  const { theme, setTheme, safeMode, toggleSafe, maxRows, setMaxRows, clearHistory } = useApp();

  return (
    <div className="page">
      <div className="pagehead"><h1>设置</h1></div>

      <div className="card" style={{ padding: '14px' }}>
        <div className="field" style={{ marginBottom: 14 }}>
          <label>外观（半夜处理故障建议深色）</label>
          <div className="seg">
            <button className={theme === 'dark' ? 'on' : ''} onClick={() => setTheme('dark')}>🌙 深色</button>
            <button className={theme === 'light' ? 'on' : ''} onClick={() => setTheme('light')}>☀️ 浅色</button>
          </div>
        </div>

        <div className="field" style={{ marginBottom: 0 }}>
          <label>查询结果最大返回行数（服务端强制截断，防止大表拖垮手机）</label>
          <div className="seg">
            {[100, 500, 1000, 5000].map(n => (
              <button key={n} className={maxRows === n ? 'on' : ''} onClick={() => setMaxRows(n)}>{n}</button>
            ))}
          </div>
        </div>
      </div>

      <div className={`card ${safeMode ? '' : 'errcard'}`} style={{ padding: '14px' }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="grow">
            <div style={{ fontWeight: 700, display: 'flex', gap: 6, alignItems: 'center' }}>
              <IconShield width={16} height={16} />安全模式（只读）
            </div>
            <div className="small mut" style={{ marginTop: 3 }}>
              开启后仅允许 SELECT / SHOW / DESC / EXPLAIN / USE，写操作会被直接拦截
            </div>
          </div>
          <button className={`btn sm ${safeMode ? '' : 'danger'}`} onClick={() => { toggleSafe(); toast(safeMode ? '已关闭，可执行写操作' : '已开启只读保护', safeMode ? 'err' : 'ok'); }}>
            {safeMode ? '已开启' : '已关闭'}
          </button>
        </div>
      </div>

      <button className="btn ghost" onClick={() => { clearHistory(); toast('历史已清空', 'ok'); }}>清空查询历史</button>
    </div>
  );
}
