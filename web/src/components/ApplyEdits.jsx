import Sheet from './Sheet.jsx';
import { copyText } from '../store.js';
import { toast } from './Toast.jsx';
import { IconShield, IconCopy } from './Icons.jsx';

// 应用单元格修改：逐条展示生成的 UPDATE（按主键定位），确认后执行
export default function ApplyEdits({ stmts, table, isProd, safeMode, applying, error, onRun, onDisableSafe, onClose }) {
  const sqlText = stmts.join(';\n') + ';';

  return (
    <Sheet title={`应用 ${stmts.length} 处修改`} onClose={onClose}>
      <div className="rmeta" style={{ padding: '8px 0', borderBottom: 'none' }}>
        <span className="chisk warn">UPDATE 修改数据</span>
        <span className="chisk gray">表 {table}</span>
        <span className="chisk gray">按主键定位 {stmts.length} 行</span>
      </div>
      {isProd && (
        <div className="prodstrip" style={{ marginTop: 4 }}>
          <IconShield width={15} height={15} />生产环境 · 执行前请仔细核对下方语句
        </div>
      )}
      <div className="editpre">{sqlText}</div>

      {safeMode ? (
        <>
          <div className="card" style={{ padding: '12px 14px', marginTop: 4 }}>
            <div style={{ fontWeight: 800 }}><IconShield width={15} height={15} /> 安全模式开启中，仅允许查询</div>
            <div className="mut small" style={{ marginTop: 6 }}>关闭安全模式后即可执行上面的修改</div>
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn grow" onClick={onClose}>取消</button>
            <button className="btn danger grow" onClick={onDisableSafe}>关闭安全模式</button>
          </div>
        </>
      ) : (
        <>
          {error && <div className="errcard" style={{ padding: '10px 12px', marginBottom: 8 }}><b>❌ {error}</b></div>}
          <div className="row">
            <button className="btn grow" disabled={applying} onClick={() => copyText(sqlText).then(() => toast('SQL 已复制', 'ok'))}>
              <IconCopy width={15} height={15} /> 复制 SQL
            </button>
            <button className="btn primary grow" disabled={applying} onClick={onRun}>
              {applying ? '执行中…' : `执行 ${stmts.length} 条`}
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}
