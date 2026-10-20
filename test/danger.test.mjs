import { analyzeSql, isReadOnly, buildCountPreview, tokenize, splitStatements } from '../web/src/lib/sqlDanger.js';

let pass = 0, fail = 0;
function eq(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { pass++; } else { fail++; console.error(`✗ ${name}\n   期望: ${JSON.stringify(expected)}\n   实际: ${JSON.stringify(actual)}`); }
}

// 基础分词：字符串里的关键词不应被识别
const a1 = analyzeSql(`SELECT * FROM t WHERE name = 'drop table x'`);
eq('字符串内关键词不触发', a1.overall, 'low');

// DROP 高危
eq('DROP 高危', analyzeSql('DROP TABLE users').overall, 'high');
eq('DROP 库-原因', analyzeSql('DROP DATABASE app').statements[0].reasons[0].reason.includes('数据库'), true);

// 注释里的关键词不算
eq('注释不触发', analyzeSql('-- drop everything\nSELECT 1').overall, 'low');
eq('块注释不触发', analyzeSql('/* drop */ SELECT 1').overall, 'low');

// 无 WHERE 的 UPDATE/DELETE → high；有 WHERE → medium
eq('UPDATE 无 WHERE', analyzeSql('UPDATE users SET age = 1').overall, 'high');
eq('DELETE 无 WHERE', analyzeSql('DELETE FROM logs').overall, 'high');
eq('UPDATE 有 WHERE', analyzeSql("UPDATE users SET age = 1 WHERE id = 5").overall, 'medium');
eq('DELETE 有 WHERE', analyzeSql("DELETE FROM logs WHERE id = 5").overall, 'medium');

// WHERE 在字符串里不算（应判 high）
eq('WHERE 在字符串里', analyzeSql("UPDATE users SET note = 'where'").overall, 'high');

// TRUNCATE
eq('TRUNCATE 高危', analyzeSql('TRUNCATE TABLE logs').overall, 'high');

// SELECT 安全
eq('SELECT 安全', analyzeSql('SELECT * FROM t LIMIT 10').overall, 'low');
eq('SELECT 无 LIMIT 提示', analyzeSql('SELECT * FROM big_table').hints.some(h => h.includes('LIMIT')), true);

// 多语句
const a2 = analyzeSql('SELECT 1; SELECT 2');
eq('多语句检测', a2.multi, true);
eq('多语句条数', a2.statements.length, 2);

// 分号在字符串内不算多语句
eq('字符串内分号', analyzeSql("SELECT 'a;b'").multi, false);
// 末尾分号不算第二条
eq('末尾分号', analyzeSql('SELECT 1;').statements.length, 1);

// ALTER DROP COLUMN → high
eq('ALTER DROP COLUMN', analyzeSql('ALTER TABLE users DROP COLUMN age').overall, 'high');
eq('普通 ALTER', analyzeSql('ALTER TABLE users ADD COLUMN age INT').overall, 'medium');

// 只读判定
eq('SELECT 只读', isReadOnly('SELECT 1'), true);
eq('SHOW 只读', isReadOnly('SHOW PROCESSLIST'), true);
eq('EXPLAIN 只读', isReadOnly('EXPLAIN SELECT 1'), true);
eq('USE 只读', isReadOnly('USE mydb'), true);
eq('UPDATE 非只读', isReadOnly('UPDATE t SET x=1 WHERE id=1'), false);
eq('SET SESSION 只读', isReadOnly('SET SESSION wait_timeout=60'), true);
eq('SET GLOBAL 非只读', isReadOnly('SET GLOBAL max_connections=100'), false);
eq('FOR UPDATE 非只读', isReadOnly('SELECT * FROM t WHERE id=1 FOR UPDATE'), false);

// COUNT 预览改写
eq('UPDATE 改写', buildCountPreview('UPDATE `users` SET age=1 WHERE id < 100').sql, 'SELECT COUNT(*) AS affected_rows FROM `users` WHERE id < 100');
eq('DELETE 改写', buildCountPreview('DELETE FROM logs WHERE created < "2026-01-01"').sql, 'SELECT COUNT(*) AS affected_rows FROM logs WHERE created < "2026-01-01"');
eq('无 WHERE 改写', buildCountPreview('DELETE FROM logs'), { table: 'logs', where: null });
eq('SELECT 不改写', buildCountPreview('SELECT * FROM t'), null);

// 分词器：反引号标识符
const tks = tokenize('SELECT * FROM `my table`').filter(t => t.t === 'ident');
eq('反引号 ident', tks[0]?.v, '`my table`');

// 大小写不敏感
eq('小写 drop', analyzeSql('drop table users').overall, 'high');

// 空 SQL
eq('空 SQL', analyzeSql('   \n ').empty, true);

// 目标表识别
eq('目标表', analyzeSql('DELETE FROM order_items WHERE id=1').statements[0].targets, ['order_items']);

console.log(`\n${fail === 0 ? '✅ 全部通过' : '❌ 存在失败'}: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
