import Sheet from './Sheet.jsx';
import HoldButton from './HoldButton.jsx';
import { IconWarn, IconShield, IconPlay } from './Icons.jsx';

const RISK_LABEL = { high: '高危', medium: '中风险', low: '低风险', block: '拦截' };

// 执行前风险确认弹层：列出风险原因 → 高危长按执行 / 中风险点按确认
export default function RunGuard({ analysis, statement, safeBlocked, isProd, onRun, onPreviewCount, onDisableSafe, onClose }) {
  const stmt = statement || analysis?.statements?.[0];
  const risk = stmt?.risk || 'low';

  // --- 多语句：直接拦截 ---
  if (analysis?.multi) {
    return (
      <Sheet title={<><IconWarn width={18} height={18} />一次只能执行一条语句</>} onClose={onClose}>
        <div className="riskitem hint"><span className="dot" />检测到 {analysis.statements.length} 条语句。为了防止误执行看不到的语句，请删掉多余的分号，只保留要执行的一条。</div>
        <div className="sqlprev">{analysis.statements.map((s, i) => `${i + 1}. ${s.sql.slice(0, 120)}`).join('\n')}</div>
        <button className="btn" style={{ width: '100%' }} onClick={onClose}>知道了</button>
      </Sheet>
    );
  }

  // --- 安全模式拦截 ---
  if (safeBlocked) {
    return (
      <Sheet title={<><IconShield width={18} height={18} />安全模式已开启</>} onClose={onClose}>
        <div className="riskitem hint">
          <span className="dot" />
          安全模式下只允许查询语句（SELECT / SHOW / DESC / EXPLAIN / USE）。当前语句包含写操作，已被拦截。
        </div>
        <div className="sqlprev">{stmt?.sql}</div>
        <button className="btn danger" style={{ width: '100%', marginBottom: 8 }} onClick={onDisableSafe}>
          我确认风险，关闭安全模式
        </button>
        <button className="btn ghost" style={{ width: '100%' }} onClick={onClose}>取消</button>
      </Sheet>
    );
  }

  const reasons = stmt?.reasons || [];
  const hints = analysis?.hints || [];

  return (
    <Sheet title={<><IconWarn width={18} height={18} />执行确认 · {RISK_LABEL[risk]}</>} onClose={onClose}>
      {isProd && (
        <div className="prodstrip" style={{ marginBottom: 10 }}>
          <IconWarn width={16} height={16} />当前是生产环境连接，请再次确认操作范围！
        </div>
      )}
      {reasons.map((r, i) => (
        <div key={i} className={`riskitem ${r.level}`}><span className="dot" />{r.reason}</div>
      ))}
      {stmt?.targets?.length > 0 && (
        <div className="small mut" style={{ margin: '4px 2px 10px' }}>
          涉及对象：<b style={{ fontFamily: 'var(--mono)' }}>{stmt.targets.join('、')}</b>
        </div>
      )}
      {hints.map((h, i) => (
        <div key={i} className="riskitem hint"><span className="dot" />{h}</div>
      ))}
      <div className="sqlprev">{stmt?.sql}</div>

      {onPreviewCount && (
        <button className="btn" style={{ width: '100%', marginBottom: 8 }} onClick={onPreviewCount}>
          🔍 先预览影响行数（SELECT COUNT）
        </button>
      )}

      {risk === 'high' ? (
        <>
          <HoldButton onComplete={onRun}>⚠ 长按 1.2 秒执行</HoldButton>
          <div className="small mut" style={{ textAlign: 'center', marginTop: 8 }}>高危操作需要长按，防止手滑</div>
        </>
      ) : (
        <button className="btn danger" style={{ width: '100%' }} onClick={onRun}>
          <IconPlay width={16} height={16} /> 确认执行
        </button>
      )}
    </Sheet>
  );
}
