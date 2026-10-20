// 常见 MySQL 错误的人性化翻译（结果区展示用）
export function explainError(errno, message, sqlMessage) {
  const raw = sqlMessage || message || '';
  const out = { title: '', hint: '' };
  switch (errno) {
    case 1044: case 1142: case 1144: case 1227:
      out.title = '权限不足'; out.hint = `当前账号没有执行此操作的权限（${errno}），请联系 DBA 授权`; break;
    case 1045:
      out.title = '认证失败'; out.hint = '账号或密码错误，或账号不允许从当前地址登录'; break;
    case 1048:
      out.title = '字段不能为空'; out.hint = '某列被设置为 NOT NULL，但插入/更新时没有给值'; break;
    case 1054:
      out.title = '列不存在'; out.hint = '检查列名拼写，或用左侧库表浏览器确认列名（点击可插入）'; break;
    case 1062:
      out.title = '唯一键冲突'; out.hint = '插入的值违反了唯一索引（主键/UNIQUE），检查是否重复或改用 ON DUPLICATE KEY'; break;
    case 1064: {
      out.title = 'SQL 语法错误';
      const m = /near '(.*)' at line (\d+)/.exec(raw);
      out.hint = m ? `第 ${m[2]} 行 附近的内容有问题：…${m[1]}…。常见原因：少了引号/括号不闭合/关键词拼错` : '检查引号、括号是否闭合，关键词是否拼错';
      break;
    }
    case 1146:
      out.title = '表不存在'; out.hint = '检查表名，或确认当前选中的数据库是否正确（点顶部数据库名可切换）'; break;
    case 1193:
      out.title = '未知系统变量'; out.hint = '变量名拼写错误或当前 MySQL 版本不支持'; break;
    case 1205:
      out.title = '锁等待超时'; out.hint = '目标行被其他事务锁住（1205），稍后重试或用 SHOW FULL PROCESSLIST 排查持锁会话'; break;
    case 1213:
      out.title = '检测到死锁'; out.hint = '事务互相等待被回滚（1213），请重试；频繁出现需排查加锁顺序'; break;
    case 1264:
      out.title = '数值超出范围'; out.hint = '值超出列类型的取值范围（如 INT 放不下超大数）'; break;
    case 1265:
      out.title = '数据被截断'; out.hint = '值与列类型不匹配（1265），检查日期/数字格式'; break;
    case 1366:
      out.title = '数据格式不匹配'; out.hint = '值无法转换为列的类型（如给数字列插了非数字字符串）'; break;
    case 1149: case 1148:
      out.title = '语法不支持'; out.hint = '该命令在此 MySQL 版本不可用'; break;
    case 1451: case 1452:
      out.title = '外键约束失败'; out.hint = `操作违反外键约束（${errno}）：${errno === 1451 ? '子表还引用着这条记录，先处理子表数据' : '引用的主表记录不存在'}`; break;
    case 1140:
      out.title = '聚合与非聚合混用'; out.hint = 'SELECT 里同时有聚合函数和普通列时，普通列必须出现在 GROUP BY 中'; break;
    default:
      if (/ECONNREFUSED/i.test(raw)) { out.title = '连接被拒绝'; out.hint = '数据库断开了连接：检查主机/端口、MySQL 运行状态、防火墙'; }
  }
  return out;
}
