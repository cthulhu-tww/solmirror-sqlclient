import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp, ENV_LABELS } from '../store.js';
import { api } from '../api.js';
import { toast } from '../components/Toast.jsx';
import { IconBack, IconPlay } from '../components/Icons.jsx';

const ENVS = ['prod', 'staging', 'dev', 'local'];

export default function ConnectionForm() {
  const nav = useNavigate();
  const { id } = useParams();
  const { connections, refreshConnections } = useApp();
  const editing = connections.find(c => c.id === id) || null;

  const [form, setForm] = useState({
    name: '', host: '', port: 3306, user: 'root', password: '', database: '', env: 'dev', note: ''
  });
  const [testing, setTesting] = useState(false);
  const [testRes, setTestRes] = useState(null);
  const [saving, setSaving] = useState(false);

  // 深链直接进入编辑页时列表可能未加载
  useEffect(() => { if (id && !editing) refreshConnections().catch(() => {}); }, [id]);

  useEffect(() => {
    if (editing) {
      setForm(f => ({ ...f, name: editing.name, host: editing.host, port: editing.port, user: editing.user, database: editing.database || '', env: editing.env, note: editing.note || '', password: '' }));
    }
  }, [editing?.id]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const doTest = async () => {
    if (!form.host || !form.user) { toast('请先填写主机和用户名', 'err'); return; }
    setTesting(true); setTestRes(null);
    try {
      const body = { ...form };
      if (id && !form.password) body.id = id; // 用已存密码测
      setTestRes(await api.testConnection(body));
    } catch (e) { setTestRes({ ok: false, raw: e.message, hint: e.hint }); }
    finally { setTesting(false); }
  };

  const save = async () => {
    if (!form.name || !form.host || !form.user) { toast('名称、主机、用户名必填', 'err'); return; }
    setSaving(true);
    try {
      await api.saveConnection({ ...form, id: id || undefined });
      await refreshConnections();
      toast(id ? '已保存' : '连接已创建', 'ok');
      nav('/');
    } catch (e) { toast(e.message, 'err'); }
    finally { setSaving(false); }
  };

  return (
    <div className="page page--notab">
      <div className="pagehead">
        <button className="btn sm ghost iconbtn" onClick={() => nav(-1)}><IconBack width={18} height={18} /></button>
        <h1>{id ? '编辑连接' : '新建连接'}</h1>
      </div>

      <div className="card" style={{ padding: '16px 14px' }}>
        <div className="field">
          <label>连接名称 *</label>
          <input className="input" placeholder="如：订单库-生产" value={form.name} onChange={e => set('name', e.target.value)} />
        </div>

        <div className="field">
          <label>环境（决定防护等级，生产环境会全程红条警示）</label>
          <div className="seg">
            {ENVS.map(ev => (
              <button
                key={ev}
                className={`${form.env === ev ? 'on' : ''} ${ev === 'prod' ? 'danger' : ''}`}
                onClick={() => set('env', ev)}
              >
                {ENV_LABELS[ev]}
              </button>
            ))}
          </div>
        </div>

        <div className="formgrid">
          <div className="field" style={{ gridColumn: 'span 2' }}>
            <label>主机 *</label>
            <input className="input mono" placeholder="hostname 或 IP" value={form.host} onChange={e => set('host', e.target.value)} />
          </div>
          <div className="field">
            <label>端口</label>
            <input className="input mono" type="number" value={form.port} onChange={e => set('port', e.target.value)} />
          </div>
          <div className="field">
            <label>用户名 *</label>
            <input className="input mono" autoCapitalize="off" value={form.user} onChange={e => set('user', e.target.value)} />
          </div>
          <div className="field" style={{ gridColumn: 'span 2' }}>
            <label>密码 {id && <span className="mut">（留空 = 保持原密码）</span>}</label>
            <input className="input mono" type="password" placeholder="AES 加密保存于本机" value={form.password} onChange={e => set('password', e.target.value)} />
          </div>
          <div className="field" style={{ gridColumn: 'span 2' }}>
            <label>默认数据库</label>
            <input className="input mono" placeholder="可留空，进入后再选" value={form.database} onChange={e => set('database', e.target.value)} />
          </div>
          <div className="field" style={{ gridColumn: 'span 2', marginBottom: 4 }}>
            <label>备注</label>
            <input className="input" placeholder="如：夜班值班用" value={form.note} onChange={e => set('note', e.target.value)} />
          </div>
        </div>
      </div>

      {testRes && (
        <div className={`card ${testRes.ok ? '' : 'errcard'}`} style={{ padding: '12px 14px', fontSize: 13.5 }}>
          {testRes.ok
            ? <span style={{ color: 'var(--ok)' }}>✅ 连接成功 · MySQL {testRes.version}</span>
            : <><b style={{ color: 'var(--danger)' }}>❌ 连接失败</b><div className="ehint">💡 {testRes.hint || testRes.raw}</div><div className="eraw">{testRes.raw}</div></>}
        </div>
      )}

      <div className="row">
        <button className="btn grow" disabled={testing} onClick={doTest}>
          {testing ? <span className="spin" /> : <IconPlay width={15} height={15} />}测试连接
        </button>
        <button className="btn primary grow" disabled={saving} onClick={save}>{saving ? '保存中…' : '保存'}</button>
      </div>
    </div>
  );
}
