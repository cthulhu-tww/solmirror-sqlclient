// editSql 单元测试：node test/edit.test.mjs
import { detectEditTarget, quoteIdent, sqlValue, sqlInputValue, buildUpdateSql } from '../web/src/lib/editSql.js';

let pass = 0, fail = 0;
const eq = (actual, expected, msg) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) pass++; else { fail++; console.error(`✗ ${msg}\n   期望: ${JSON.stringify(expected)}\n   实际: ${JSON.stringify(actual)}`); }
};

// ---------- detectEditTarget ----------
eq(detectEditTarget('SELECT * FROM agent_messages'), { table: 'agent_messages', quoted: '`agent_messages`' }, '简单查询');
eq(detectEditTarget('select id, name from t where id = 1'), { table: 't', quoted: '`t`' }, '小写+where');
eq(detectEditTarget('SELECT * FROM t x WHERE x.id = 1'), { table: 't', quoted: '`t`' }, '表别名');
eq(detectEditTarget('SELECT * FROM t AS a ORDER BY id DESC LIMIT 10'), { table: 't', quoted: '`t`' }, 'AS+ORDER+LIMIT');
eq(detectEditTarget('SELECT * FROM yxkj.agent_messages WHERE id > 100'), { table: 'agent_messages', quoted: '`yxkj`.`agent_messages`' }, '库名.表名');
eq(detectEditTarget('SELECT * FROM `yxkj`.`agent messages`'), { table: 'agent messages', quoted: '`yxkj`.`agent messages`' }, '反引号表名');
eq(detectEditTarget("SELECT * FROM t WHERE name = 'join db'"), { table: 't', quoted: '`t`' }, '字符串里的关键词不误判');
eq(detectEditTarget('SELECT * FROM t -- group by 什么\n WHERE id=1'), { table: 't', quoted: '`t`' }, '注释里的关键词不误判');

eq(detectEditTarget('UPDATE t SET a = 1 WHERE id = 1'), null, 'UPDATE 拒绝');
eq(detectEditTarget('SELECT * FROM t JOIN u ON t.id = u.id'), null, 'JOIN 拒绝');
eq(detectEditTarget('SELECT * FROM t, u'), null, '逗号多表拒绝');
eq(detectEditTarget('SELECT * FROM (SELECT * FROM t) x'), null, 'FROM 子查询拒绝');
eq(detectEditTarget('SELECT (SELECT max(id) FROM u) AS m FROM t'), null, 'SELECT 列表子查询拒绝');
eq(detectEditTarget('SELECT count(*) FROM t'), null, '聚合函数拒绝');
eq(detectEditTarget('SELECT DISTINCT * FROM t'), null, 'DISTINCT 拒绝');
eq(detectEditTarget('SELECT * FROM t GROUP BY status'), null, 'GROUP BY 拒绝');
eq(detectEditTarget('SELECT * FROM t UNION SELECT * FROM u'), null, 'UNION 拒绝');
eq(detectEditTarget('SELECT * FROM t FOR UPDATE'), null, 'FOR UPDATE 拒绝');
eq(detectEditTarget('WITH x AS (SELECT 1) SELECT * FROM x'), null, 'CTE 拒绝');
eq(detectEditTarget('SELECT * FROM a.b.c'), null, '三段名拒绝');
eq(detectEditTarget(''), null, '空');
eq(detectEditTarget(null), null, 'null');

// ---------- 转义 ----------
eq(sqlValue(null), 'NULL', 'null');
eq(sqlValue(42), '42', '数字');
eq(sqlValue(-3.5), '-3.5', '负小数');
eq(sqlValue("it's"), "'it\\'s'", "单引号转义");
eq(sqlValue('a\\b'), "'a\\\\b'", '反斜杠转义');
eq(sqlValue("a'\\b"), "'a\\'\\\\b'", '混合转义');
eq(sqlInputValue(null), 'NULL', '输入 null');
eq(sqlInputValue('123'), "'123'", '输入数字串按字符串引号');
eq(quoteIdent('order'), '`order`', '标识符');
eq(quoteIdent('a`b'), '`a``b`', '标识符反引号转义');

// ---------- buildUpdateSql ----------
eq(
  buildUpdateSql({ quoted: '`t`', sets: [{ col: 'name', value: '张三' }], where: [{ col: 'id', value: 5 }] }),
  "UPDATE `t` SET `name` = '张三' WHERE `id` = 5",
  '基本 UPDATE'
);
eq(
  buildUpdateSql({ quoted: '`yxkj`.`t`', sets: [{ col: 'a', value: 'x' }, { col: 'b', value: null }], where: [{ col: 'id', value: 1 }, { col: 'uid', value: 'u9' }] }),
  "UPDATE `yxkj`.`t` SET `a` = 'x', `b` = NULL WHERE `id` = 1 AND `uid` = 'u9'",
  '多列+复合主键+NULL'
);

console.log(`\n${fail ? '❌' : '✅'} editSql 测试：${pass} 通过，${fail} 失败`);
process.exit(fail ? 1 : 0);
