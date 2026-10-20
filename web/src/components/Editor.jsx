import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { EditorView, keymap, lineNumbers, highlightActiveLine, Decoration } from '@codemirror/view';
import { EditorState, RangeSet, Compartment } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { autocompletion } from '@codemirror/autocomplete';
import { sql, MySQL } from '@codemirror/lang-sql';
import { HighlightStyle, syntaxHighlighting, syntaxTree } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { tokenize, DANGER_WORDS } from '../lib/sqlDanger.js';

// ---------- SQL 语法高亮（颜色走主题变量，深浅主题各自定义） ----------
const sqlHighlight = HighlightStyle.define([
  { tag: t.keyword, color: 'var(--sql-kw)', fontWeight: '600' },
  { tag: t.typeName, color: 'var(--sql-type)' },
  { tag: t.string, color: 'var(--sql-str)' },
  { tag: t.special(t.string), color: 'var(--sql-str)' },      // 反引号标识符
  { tag: t.number, color: 'var(--sql-num)' },
  { tag: t.bool, color: 'var(--sql-kw)' },
  { tag: t.null, color: 'var(--sql-kw)' },
  { tag: t.standard(t.name), color: 'var(--sql-fn)' },        // COUNT/NOW 等内置函数
  { tag: [t.lineComment, t.blockComment], color: 'var(--sql-comment)', fontStyle: 'italic' },
]);

// ---------- 表名 / 字段名着色：用当前库 schema 元数据 ----------
// 规则：FROM/JOIN/INTO/UPDATE/TABLE 后的第一个标识符 → 表名（db.table 取最后一段）；
//       其余标识符若命中已知表名 → 表名色；命中已知列名 → 字段色。
const TABLE_LEADS = new Set(['FROM', 'JOIN', 'INTO', 'UPDATE', 'TABLE', 'REFERENCES']);

function schemaWordPlugin(schema) {
  const tables = new Set(Object.keys(schema || {}).map(k => k.toLowerCase()));
  const cols = new Set();
  for (const arr of Object.values(schema || {})) for (const c of arr) cols.add(String(c).toLowerCase());

  return EditorView.decorations.compute(['doc'], (state) => {
    // 语法树里 Keyword 节点的区间：撞名关键词的列（如 order/key）不按字段着色
    const kwRanges = [];
    syntaxTree(state).iterate({
      enter: node => { if (node.name === 'Keyword') kwRanges.push([node.from, node.to]); }
    });
    const isKeyword = (pos) => kwRanges.some(([a, b]) => pos >= a && pos < b);

    const toks = tokenize(state.doc.toString()).filter(tk => tk.t !== 'ws' && tk.t !== 'comment');
    const mark = new Array(toks.length).fill(null);   // 'table' | 'col'
    let expect = false;       // 下一个标识符按表名
    let lastTable = -1;       // 最近标记的表名下标（处理 db.table 时撤换）
    for (let i = 0; i < toks.length; i++) {
      const tk = toks[i];
      if (tk.t === 'word' && TABLE_LEADS.has(tk.v.toUpperCase())) { expect = true; continue; }
      if (tk.t === 'op' && tk.v === '.' && lastTable >= 0 && i === lastTable + 1) {
        mark[lastTable] = null;   // db.table：前半段是库名，表名取后一段
        expect = true;
        continue;
      }
      if (tk.t === 'word' || tk.t === 'ident') {
        const name = tk.v.replace(/`/g, '').toLowerCase();
        if (expect) { mark[i] = 'table'; lastTable = i; expect = false; continue; }
        if (!isKeyword(tk.start)) {
          if (tables.has(name)) { mark[i] = 'table'; lastTable = -1; continue; }
          if (cols.has(name)) mark[i] = 'col';
        }
        lastTable = -1;
      } else {
        expect = false; lastTable = -1;
      }
    }
    const rs = [];
    for (let i = 0; i < toks.length; i++) {
      if (!mark[i]) continue;
      const cls = mark[i] === 'table' ? 'cm-sql-table' : 'cm-sql-col';
      rs.push(Decoration.mark({ class: cls }).range(toks[i].start, toks[i].end));
    }
    rs.sort((a, b) => a.from - b.from);
    return RangeSet.of(rs);
  });
}

// ---------- 危险词实时高亮：分词器保证字符串/注释里的关键词不被着色 ----------
const highSet = new Set(DANGER_WORDS.high);
const medSet = new Set(DANGER_WORDS.medium);

const dangerPlugin = EditorView.decorations.compute(['doc'], (state) => {
  const text = state.doc.toString();
  const rs = [];
  for (const tk of tokenize(text)) {
    if (tk.t !== 'word') continue;
    const up = tk.v.toUpperCase();
    if (highSet.has(up)) rs.push(Decoration.mark({ class: 'cm-danger-word' }).range(tk.start, tk.end));
    else if (medSet.has(up)) rs.push(Decoration.mark({ class: 'cm-warn-word' }).range(tk.start, tk.end));
  }
  rs.sort((a, b) => a.from - b.from);
  return RangeSet.of(rs);
});

const langComp = new Compartment();
const schemaComp = new Compartment();

// ---------- 字段名智能补全 ----------
// lang-sql 原生只在「表名.」点号后才给列名，手机上不实用。
// 做法：整体 override 成单一补全源，内部调用原生的表名/关键词补全 + 自己的列名补全，
// 手工合并结果（多源交给 CM 合并行为不可控，合并后列名曾不出现）。
const TABLE_KEYS = new Set(['FROM', 'JOIN', 'INTO', 'UPDATE']);
const EXPR_KEYS = new Set(['WHERE', 'ON', 'SET', 'GROUP', 'HAVING', 'ORDER', 'LIMIT', 'OFFSET', 'UNION', 'INTERSECT', 'EXCEPT', 'SELECT', 'VALUES', 'BY', 'AS', 'ALL', 'DISTINCT']);

function makeColumnCompletion(schemaRef) {
  return (context) => {
    const schema = schemaRef.current || {};
    const word = context.matchBefore(/[\w$]+/);
    if (!word || (word.from === word.to && !context.explicit)) return null;

    const toks = tokenize(context.state.doc.toString()).filter(tk => tk.t !== 'ws' && tk.t !== 'comment');
    // 点号后是「别名.列」限定写法，原生补全已覆盖
    let prev = null;
    for (const tk of toks) { if (tk.end <= word.from) prev = tk; else break; }
    if (prev && prev.t === 'op' && prev.v === '.') return null;

    // 扫描当前语句：收集 FROM/JOIN/UPDATE 引用的表（含光标之后写的，回头补 SELECT 列也能弹）；
    // 光标处在表区间（正在输表名）时不弹列名
    let zone = 'expr';
    let zoneAtCursor = null;
    const tables = [];
    for (const tk of toks) {
      const up = tk.t === 'word' ? tk.v.toUpperCase() : '';
      if (up && TABLE_KEYS.has(up)) zone = 'table';
      else if (up && EXPR_KEYS.has(up)) zone = 'expr';
      else if (tk.t === 'op' && tk.v === ';') { zone = 'expr'; tables.length = 0; }
      else if (zone === 'table' && (tk.t === 'word' || tk.t === 'ident')) tables.push(tk.v.replace(/`/g, ''));
      if (zoneAtCursor === null && tk.end >= word.to) zoneAtCursor = zone;
    }
    if (zoneAtCursor === 'table' || !tables.length) return null;

    const seen = new Set();
    const options = [];
    for (const t of tables) {
      const cols = schema[t.toLowerCase()];
      if (!cols) continue;
      for (const c of cols) {
        if (seen.has(c)) continue;
        seen.add(c);
        options.push({ label: c, detail: t, type: 'property', boost: 1 });
      }
    }
    return options.length ? { from: word.from, options, validFor: /^[\w$]*$/ } : null;
  };
}

// 单一补全源：列名（自己的） + 表名/关键词（原生 sql 的，从 languageData 取来调用）
function makeCombinedCompletion(schemaRef) {
  const columnSource = makeColumnCompletion(schemaRef);
  const combined = (context) => {
    const mine = columnSource(context);
    const nativeResults = [];
    for (const src of context.state.languageDataAt('autocomplete', context.pos)) {
      if (src === combined) continue;
      try { const r = src(context); if (r && r.options && r.options.length) nativeResults.push(r); } catch { /* 单个源失败不影响其他 */ }
    }
    if (!mine) return nativeResults[0] || null;
    if (!nativeResults.length) return mine;
    const opts = [...mine.options];
    const seen = new Set(opts.map(o => o.label));
    for (const n of nativeResults) {
      for (const o of n.options) {
        if (!seen.has(o.label)) { seen.add(o.label); opts.push(o); }
      }
    }
    return { from: Math.min(mine.from, ...nativeResults.map(n => n.from)), options: opts, validFor: /^[\w$]*$/ };
  };
  return combined;
}

const Editor = forwardRef(function Editor({ value, onChange, schema }, ref) {
  const hostRef = useRef(null);
  const viewRef = useRef(null);
  const schemaRef = useRef(schema || {});

  useImperativeHandle(ref, () => ({
    insert(text, { cursorOffset = 0 } = {}) {
      const view = viewRef.current;
      if (!view) return;
      const sel = view.state.selection.main;
      view.dispatch({
        changes: { from: sel.from, to: sel.to, insert: text },
        selection: { anchor: sel.from + text.length + cursorOffset }
      });
      view.focus();
    },
    setValue(v) {
      const view = viewRef.current;
      if (!view) return;
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: v } });
    },
    focus() { viewRef.current?.focus(); }
  }), []);

  useEffect(() => {
    const view = viewRef.current;
    if (view && schema !== schemaRef.current) {
      schemaRef.current = schema || {};
      view.dispatch({
        effects: [
          langComp.reconfigure(sql({ dialect: MySQL, schema: schemaRef.current, upperCaseKeywords: true })),
          schemaComp.reconfigure(schemaWordPlugin(schemaRef.current))
        ]
      });
    }
  }, [schema]);

  useEffect(() => {
    const state = EditorState.create({
      doc: value || '',
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        EditorView.lineWrapping,
        // 打字时自动弹出补全：override 成单一合并源（列名 + 原生表名/关键词）
        autocompletion({
          activateOnTypingDelay: 100, icons: false, maxRenderedOptions: 30,
          override: [makeCombinedCompletion(schemaRef)]
        }),
        langComp.of(sql({ dialect: MySQL, schema: schemaRef.current, upperCaseKeywords: true })),
        // SQL 语法高亮：关键词/字符串/数字/注释 + schema 驱动的表名/字段名
        syntaxHighlighting(sqlHighlight),
        schemaComp.of(schemaWordPlugin(schemaRef.current)),
        dangerPlugin,
        EditorView.updateListener.of(u => { if (u.docChanged) onChange && onChange(u.state.doc.toString()); })
      ]
    });
    viewRef.current = new EditorView({ state, parent: hostRef.current });
    return () => viewRef.current?.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div className="edwrap" ref={hostRef} />;
});

export default Editor;
