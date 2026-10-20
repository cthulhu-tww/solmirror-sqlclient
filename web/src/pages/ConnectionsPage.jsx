import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp, ENV_LABELS } from '../store.js';
import { api } from '../api.js';
import Sheet from '../components/Sheet.jsx';
import { toast } from '../components/Toast.jsx';
import { IconPlus, IconEdit, IconTrash, IconPlay, IconChevron } from '../components/Icons.jsx';

export default function ConnectionsPage() {
  const nav = useNavigate();
  const { connections, refreshConnections, activeConn, setActiveConn } = useApp();
  const [menuConn, setMenuConn] = useState(null);
  const [testing, setTesting] = useState(null);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => { refreshConnections().catch(e => toast(e.message, 'err')); }, []);

  const enter = (c) => {
    setActiveConn(c);
    nav('/query');
  };

  const doTest = async (c) => {
    setTesting(c.id); setTestResult(null);
    try {
      const r = await api.testConnection({ id: c.id });
      setTestResult({ name: c.name, ...r });
      toast(r.ok ? `连接成功 · MySQL ${r.version || ''}` : `失败：${r.raw || r.error}`, r.ok ? 'ok' : 'err');
    } catch (e) { toast(e.message, 'err'); }
    finally { setTesting(null); }
  };

  const doDelete = async (c) => {
    setMenuConn(null);
    try {
      await api.deleteConnection(c.id);
      await refreshConnections();
      toast('已删除', 'ok');
    } catch (e) { toast(e.message, 'err'); }
  };

  return (
    <div className="page">
      <div className="pagehead">
        <h1><span className="logo">S</span>SolSQL <span className="chisk gray" style={{ marginLeft: 4 }}>MySQL</span></h1>
      </div>

      {!connections.length && (
        <div className="card empty">
          <div className="big">🗄️</div>
          还没有数据库连接<br />
          <span className="small mut">点右下角 + 新建一个，密码会加密保存在本机</span>
        </div>
      )}

      {connections.map(c => (
        <div
          key={c.id}
          className={`card conncard ${activeConn?.id === c.id ? 'on' : ''}`}
          onClick={() => enter(c)}
        >
          <div className="meta">
            <div className="name">
              {c.name}
              <span className={`chip env env-${c.env}`}>{ENV_LABELS[c.env] || c.env}</span>
            </div>
            <div className="host">{c.user}@{c.host}:{c.port}{c.database ? ` / ${c.database}` : ''}</div>
            {c.note && <div className="small mut" style={{ marginTop: 2 }}>{c.note}</div>}
          </div>
          <button
            className="btn sm ghost iconbtn"
            style={{ width: 38, height: 38, minHeight: 38 }}
            onClick={e => { e.stopPropagation(); setMenuConn(c); }}
            aria-label="更多操作"
          >
            <IconChevron width={15} height={15} />
          </button>
        </div>
      ))}

      {testResult && (
        <div className={`card ${testResult.ok ? '' : 'errcard'}`} style={{ padding: '12px 14px', fontSize: 13.5 }}>
          {testResult.ok
            ? <span style={{ color: 'var(--ok)' }}>✅ {testResult.name} 连接正常 · MySQL {testResult.version}</span>
            : <><b style={{ color: 'var(--danger)' }}>❌ {testResult.name} 连接失败</b><div className="ehint">💡 {testResult.hint || '检查网络与账号'}</div></>}
        </div>
      )}

      <button className="fab" onClick={() => nav('/conn/new')} aria-label="新建连接"><IconPlus width={26} height={26} /></button>

      {menuConn && (
        <Sheet title={menuConn.name} onClose={() => setMenuConn(null)}>
          <div className="row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
            <button className="btn" disabled={testing === menuConn.id} onClick={() => doTest(menuConn)}>
              {testing === menuConn.id ? <span className="spin" /> : <IconPlay width={15} height={15} />}
              {testing === menuConn.id ? '测试中…' : '测试连接'}
            </button>
            <button className="btn" onClick={() => { const c = menuConn; setMenuConn(null); nav(`/conn/${c.id}`); }}>
              <IconEdit width={15} height={15} />编辑连接
            </button>
            <button className="btn danger" onClick={() => doDelete(menuConn)}>
              <IconTrash width={15} height={15} />删除连接
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
