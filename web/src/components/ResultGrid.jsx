import { useMemo, useState } from 'react';
import CellViewer from './CellViewer.jsx';
import { copyText } from '../store.js';
import { toast } from './Toast.jsx';
import { IconSearch } from './Icons.jsx';

// 结果表格：冻结表头/首列、排序、搜索、点单元格看详情、分批渲染
// edits: { 原始行号: { 列名: { v, isNull } } }，onEditCell(原始行号, 列名) 打开编辑弹层
const PAGE = 100;

function renderCell(v) {
  if (v === null) return <span className="cellnull">NULL</span>;
  if (typeof v === 'object' && v.__blob) return <span className="cellblob">[BLOB {v.size}B]</span>;
  if (typeof v === 'number') return <span className="cellnum">{v}</span>;
  return String(v);
}

function cellText(v) {
  if (v === null) return 'NULL';
  if (typeof v === 'object' && v.__blob) return `[BLOB ${v.size}B]`;
  return String(v);
}

export default function ResultGrid({ result, edits = {}, isColEditable = null, onEditCell = null }) {
  const [sort, setSort] = useState(null);      // { col, dir: 1|-1 }
  const [filter, setFilter] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const [cell, setCell] = useState(null);      // { column, value, rowIndex, row, onEdit }

  const { columns, rows } = result;

  // 视图行（可能排序/筛选过）→ 原始行号 的映射，编辑要用原始行取主键值
  const rowIdxMap = useMemo(() => {
    const m = new Map();
    rows.forEach((r, i) => m.set(r, i));
    return m;
  }, [rows]);

  const canEdit = !!isColEditable && !!onEditCell;

  const view = useMemo(() => {
    let r = rows;
    if (filter) {
      const f = filter.toLowerCase();
      r = r.filter(row => columns.some(c => cellText(row[c]).toLowerCase().includes(f)));
    }
    if (sort) {
      const { col, dir } = sort;
      r = [...r].sort((a, b) => {
        const x = a[col], y = b[col];
        if (x === null) return 1;
        if (y === null) return -1;
        if (typeof x === 'number' && typeof y === 'number') return (x - y) * dir;
        return String(x).localeCompare(String(y), 'zh-CN', { numeric: true }) * dir;
      });
    }
    return r;
  }, [rows, columns, filter, sort]);

  const tapHeader = (col) => {
    setSort(s => (!s || s.col !== col) ? { col, dir: 1 } : s.dir === 1 ? { col, dir: -1 } : null);
  };

  const copyAll = () => {
    const tsv = [columns.join('\t'), ...view.map(r => columns.map(c => cellText(r[c])).join('\t'))].join('\n');
    copyText(tsv).then(() => toast(`已复制 ${view.length} 行（TSV，可粘贴到表格）`, 'ok'));
  };

  const tapCell = (row, viewIdx, c) => {
    const origIdx = rowIdxMap.get(row);
    const e = edits[origIdx]?.[c];
    const v = e === undefined ? row[c] : (e.isNull ? null : e.v);
    const isBlob = typeof v === 'object' && v !== null && v.__blob;
    const editable = canEdit && isColEditable(c) && !isBlob;
    setCell({
      column: c, value: v, row, rowIndex: viewIdx,
      onEdit: editable ? () => { setCell(null); onEditCell(origIdx, c); } : null
    });
  };

  return (
    <div className="resultcard card">
      <div className="rsearch">
        <IconSearch width={16} height={16} style={{ color: 'var(--muted)', flex: 'none' }} />
        <input className="input" placeholder={`在 ${rows.length} 行结果中筛选…`} value={filter} onChange={e => { setFilter(e.target.value); setLimit(PAGE); }} />
        <button className="btn sm" onClick={copyAll}>复制全部</button>
      </div>
      <div className="rscroll">
        <table className="rtable">
          <thead>
            <tr>
              <th className="sticky1">#</th>
              {columns.map(c => (
                <th key={c} onClick={() => tapHeader(c)}>
                  {c}{sort?.col === c && <span className="arr">{sort.dir === 1 ? '↑' : '↓'}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.slice(0, limit).map((row, i) => (
              <tr key={i}>
                <td className="sticky1 rownum">{i + 1}</td>
                {columns.map(c => {
                  const origIdx = rowIdxMap.get(row);
                  const e = edits[origIdx]?.[c];
                  const v = e === undefined ? row[c] : (e.isNull ? null : e.v);
                  return (
                    <td key={c} className={e !== undefined ? 'dirty' : undefined} onClick={() => tapCell(row, i, c)}>
                      {renderCell(v)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {!view.length && <div className="empty"><div className="big">📭</div>{filter ? '没有匹配筛选的行' : '结果为空'}</div>}
        {view.length > limit && (
          <button className="loadmore" onClick={() => setLimit(l => l + PAGE)}>
            加载更多（剩余 {view.length - limit} 行）
          </button>
        )}
      </div>
      {cell && <CellViewer {...cell} onClose={() => setCell(null)} />}
    </div>
  );
}
