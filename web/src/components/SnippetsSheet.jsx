import Sheet from './Sheet.jsx';
import { IconBolt, IconTable } from './Icons.jsx';

// SQL 片段模板（含运维内置）。点击 → 载入编辑器
const SNIPPETS = [
  { group: '查询', icon: '🔍', name: '查表数据', sql: 'SELECT *\nFROM `表名`\nLIMIT 100;' },
  { group: '查询', icon: '🔍', name: '条件查询', sql: 'SELECT *\nFROM `表名`\nWHERE id = 1\nLIMIT 100;' },
  { group: '查询', icon: '🔢', name: '统计行数', sql: 'SELECT COUNT(*) AS cnt\nFROM `表名`;' },
  { group: '写入', icon: '✏️', name: '安全更新模板', sql: '-- 记得先点「预览影响行数」\nUPDATE `表名`\nSET col = \'新值\'\nWHERE id = 1;' },
  { group: '写入', icon: '➕', name: '插入数据', sql: 'INSERT INTO `表名` (col1, col2)\nVALUES (\'值1\', \'值2\');' },
  { group: '运维', icon: '⚡', name: '查看所有连接（PROCESSLIST）', sql: 'SHOW FULL PROCESSLIST;' },
  { group: '运维', icon: '⚡', name: '排查非睡眠连接', sql: 'SELECT id, user, host, db, command, time, state, LEFT(info, 120) AS sql_head\nFROM information_schema.PROCESSLIST\nWHERE command != \'Sleep\'\nORDER BY time DESC;' },
  { group: '运维', icon: '💀', name: '杀掉连接/查询（高危）', sql: '-- 把 12345 换成 PROCESSLIST 里的 id\nKILL 12345;' },
  { group: '运维', icon: '⚡', name: '连接数状态', sql: 'SHOW STATUS LIKE \'Threads%\';' },
  { group: '运维', icon: '⚡', name: 'InnoDB 状态', sql: 'SHOW ENGINE INNODB STATUS;' },
  { group: '运维', icon: '⚡', name: '库内表大小 Top20', sql: 'SELECT TABLE_NAME AS name, TABLE_ROWS AS rows_est,\n  ROUND((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024, 1) AS mb\nFROM information_schema.TABLES\nWHERE TABLE_SCHEMA = DATABASE()\nORDER BY (DATA_LENGTH + INDEX_LENGTH) DESC\nLIMIT 20;' },
  { group: '运维', icon: '⚡', name: '服务器版本', sql: 'SELECT @@version AS version, @@version_comment AS comment;' },
  { group: '运维', icon: '⚡', name: '查变量', sql: 'SHOW VARIABLES LIKE \'max_connections\';' },
  { group: '运维', icon: '⚡', name: '当前库自增用量', sql: 'SELECT TABLE_NAME AS name, AUTO_INCREMENT\nFROM information_schema.TABLES\nWHERE TABLE_SCHEMA = DATABASE() AND AUTO_INCREMENT IS NOT NULL\nORDER BY AUTO_INCREMENT DESC\nLIMIT 20;' }
];

export default function SnippetsSheet({ onUse, onClose }) {
  const groups = [...new Set(SNIPPETS.map(s => s.group))];
  return (
    <Sheet title={<><IconTable width={18} height={18} />SQL 片段模板</>} onClose={onClose}>
      <div className="small mut" style={{ margin: '-4px 2px 12px' }}>点击直接填入编辑器（会替换现有内容）</div>
      {groups.map(g => (
        <div key={g}>
          <div className="datehead">{g}</div>
          {SNIPPETS.filter(s => s.group === g).map((s, i) => (
            <button key={i} className="snip" onClick={() => onUse(s.sql)}>
              <div className="sname"><span>{s.icon}</span>{s.name}</div>
              <div className="ssql">{s.sql}</div>
            </button>
          ))}
        </div>
      ))}
    </Sheet>
  );
}
