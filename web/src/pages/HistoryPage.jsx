import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp, ENV_LABELS, fmtMs, fmtTime } from '../store.js';
import Sheet from '../components/Sheet.jsx';
import { toast } from '../components/Toast.jsx';
import { IconStar, IconTrash } from '../components/Icons.jsx';

export default function HistoryPage() {
  const nav = useNavigate();
  const { history, clearHistory, favorites, addFavorite, removeFavorite, isFavorited, setPendingSql, activeConn } = useApp();
  const [tab, setTab] = useState('hist');
  const [confirmClear, setConfirmClear] = useState(false);

  const groups = useMemo(() => {
    const list = activeConn ? history.filter(h => h.connId === activeConn.id) : history;
    const map = new Map();
    for (const h of list) {
      const d = new Date(h.at);
      const key = `${d.getMonth() + 1}月${d.getDate()}日`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(h);
    }
    return [...map.entries()];
  }, [history, activeConn]);

  const load = (sql) => { setPendingSql(sql); nav('/query'); };

  const RISK_CHIP = { high: ['danger', '高危'], medium: ['warn', '中危'], low: ['info', ''] };

  return (
    <div className="page">
      <div className="pagehead"><h1>历史 / 收藏</h1></div>

      <div className="seg">
        <button className={tab === 'hist' ? 'on' : ''} onClick={() => setTab('hist')}>历史 {history.length ? `(${history.length})` : ''}</button>
        <button className={tab === 'fav' ? 'on' : ''} onClick={() => setTab('fav')}>收藏 {favorites.length ? `(${favorites.length})` : ''}</button>
      </div>

      {activeConn && tab === 'hist' && (
        <div className="small mut" style={{ marginTop: -4 }}>仅显示「{activeConn.name}」的记录</div>
      )}

      {tab === 'hist' && (
        <>
          {!history.length && <div className="card empty"><div className="big">🕘</div>还没有执行记录</div>}
          {groups.map(([day, items]) => (
            <div key={day}>
              <div className="datehead">{day}</div>
              <div className="card">
                {items.map(h => (
                  <div key={h.id} className="histitem" style={{ borderBottom: '1px solid var(--border)' }} onClick={() => load(h.sql)}>
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="hsql">{h.sql}</div>
                      <div className="hmeta">
                        {h.ok
                          ? <span style={{ color: 'var(--ok)' }}>✓ 成功</span>
                          : <span style={{ color: 'var(--danger)' }}>✗ 失败</span>}
                        <span>{fmtTime(h.at)}</span>
                        <span>⏱ {fmtMs(h.ms)}</span>
                        {RISK_CHIP[h.risk]?.[1] && <span className={`chisk ${RISK_CHIP[h.risk][0]}`}>{RISK_CHIP[h.risk][1]}</span>}
                        {h.connName && <span className={`chip env env-${h.env}`}>{h.connName}</span>}
                      </div>
                    </div>
                    <button
                      className={`star ${isFavorited(h.sql) ? 'on' : ''}`}
                      onClick={e => { e.stopPropagation(); addFavorite(h.sql); toast('已收藏', 'ok'); }}
                      aria-label="收藏"
                    >
                      <IconStar on={isFavorited(h.sql)} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {history.length > 0 && (
            <button className="btn ghost" onClick={() => setConfirmClear(true)}><IconTrash width={14} height={14} />清空全部历史</button>
          )}
        </>
      )}

      {tab === 'fav' && (
        <>
          {!favorites.length && <div className="card empty"><div className="big">⭐</div>在查询页点「收藏」保存常用 SQL</div>}
          <div className="card">
            {favorites.map(f => (
              <div key={f.id} className="histitem" style={{ borderBottom: '1px solid var(--border)' }} onClick={() => load(f.sql)}>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="hsql">{f.sql}</div>
                </div>
                <button className="star on" onClick={e => { e.stopPropagation(); removeFavorite(f.id); toast('已取消收藏', ''); }} aria-label="取消收藏">
                  <IconStar on={true} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {confirmClear && (
        <Sheet title="清空全部历史？" onClose={() => setConfirmClear(false)}>
          <div className="riskitem hint"><span className="dot" />将删除本机保存的所有执行记录（收藏不受影响）。</div>
          <div className="row">
            <button className="btn grow ghost" onClick={() => setConfirmClear(false)}>取消</button>
            <button className="btn grow danger" onClick={() => { clearHistory(); setConfirmClear(false); toast('已清空', 'ok'); }}>确认清空</button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
