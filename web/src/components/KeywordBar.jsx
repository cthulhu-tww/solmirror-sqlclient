import { useState } from 'react';

// SQL 关键词快捷栏：手机上点按代替键盘输入
// chip: { t: 插入文本, off: 插入后光标回退位数, cls: 颜色类 }
const GROUPS = [
  {
    name: '基础',
    chips: [
      { t: 'SELECT *' }, { t: 'FROM' }, { t: 'WHERE' }, { t: 'ORDER BY ' }, { t: 'DESC' }, { t: 'ASC' },
      { t: 'GROUP BY ' }, { t: 'HAVING' }, { t: 'LIMIT 100' }, { t: 'AS' }, { t: 'DISTINCT' },
      { t: 'JOIN' }, { t: 'LEFT JOIN' }, { t: 'INNER JOIN' }, { t: 'ON' }, { t: 'UNION ALL' }, { t: 'IN (' , off: -1 }, { t: ')' }
    ]
  },
  {
    name: '条件',
    chips: [
      { t: 'AND' }, { t: 'OR' }, { t: 'NOT' }, { t: '=' }, { t: '<>' }, { t: '!=' }, { t: '>' }, { t: '<' }, { t: '>=' }, { t: '<=' },
      { t: "LIKE '" , off: -1 }, { t: "'%'", off: -1 }, { t: 'BETWEEN' }, { t: 'IS NULL' }, { t: 'IS NOT NULL' },
      { t: 'CASE WHEN' }, { t: 'THEN' }, { t: 'END' }
    ]
  },
  {
    name: '函数',
    chips: [
      { t: 'COUNT(*)' }, { t: 'SUM(' , off: -1 }, { t: 'AVG(' , off: -1 }, { t: 'MAX(' , off: -1 }, { t: 'MIN(' , off: -1 },
      { t: 'NOW()' }, { t: 'CURDATE()' }, { t: 'DATE(' , off: -1 }, { t: "DATE_FORMAT(", off: -1 }, { t: 'CONCAT(' , off: -1 },
      { t: 'IFNULL(' , off: -1 }, { t: 'SUBSTRING(' , off: -1 }, { t: 'UNIX_TIMESTAMP()' }
    ]
  },
  {
    name: '写入',
    chips: [
      { t: 'INSERT INTO ' , cls: 'warn' }, { t: 'VALUES (' , off: -1, cls: 'warn' }, { t: 'ON DUPLICATE KEY UPDATE', cls: 'warn' },
      { t: 'UPDATE ' , cls: 'warn' }, { t: 'SET ' , cls: 'warn' },
      { t: 'DELETE FROM ' , cls: 'danger' },
      { t: 'ALTER TABLE ' , cls: 'warn' }, { t: 'ADD COLUMN ' , cls: 'warn' }, { t: 'DROP TABLE ' , cls: 'danger' }, { t: 'TRUNCATE TABLE ', cls: 'danger' }
    ]
  },
  {
    name: '符号',
    chips: [
      { t: '(' }, { t: ')' }, { t: ',' }, { t: ';' }, { t: "'" }, { t: '`' }, { t: '*' }, { t: '.' }, { t: '_' }, { t: '%' }, { t: '?' }, { t: '\n' , lab: '↵' }
    ]
  }
];

export default function KeywordBar({ editorRef }) {
  const [gi, setGi] = useState(0);

  const tap = (chip) => {
    const text = chip.t === '\n' ? '\n' : chip.t + ' ';
    editorRef.current?.insert(text, { cursorOffset: chip.off || 0 });
  };

  return (
    <div className="kwbar">
      <div className="kwtabs">
        {GROUPS.map((g, i) => (
          <button key={g.name} className={i === gi ? 'on' : ''} onClick={() => setGi(i)}>{g.name}</button>
        ))}
      </div>
      <div className="kwrow">
        {GROUPS[gi].chips.map((c, i) => {
          const label = c.lab || (c.t === '\n' ? '↵ 换行' : c.t.trim());
          return <button key={i} className={`kw ${c.cls || ''}`} onClick={() => tap(c)}>{label}</button>;
        })}
      </div>
    </div>
  );
}
