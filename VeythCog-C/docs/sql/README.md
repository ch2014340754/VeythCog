# docs/sql 执行说明

按编号顺序执行；除注明外均为幂等（重复执行安全）。执行前建议先备份相关表。

| 脚本 | 作用 | 备注 |
|---|---|---|
| `003_app_user.sql` → `007` / `008` | 用户 / 角色 | 新库从 003 起 |
| `009` → `010` → `011` | 知识库建表 / v0.3 迁移 / 删除 `lib_type` | 顺序不可颠倒 |
| `012_nav.sql` | 导航分类 / 书签 / **`nav_setting`** | `nav_setting` 段已被 022 取代；执行过 022 后不要再重跑本脚本 |
| `013_nav_bookmark_icon.sql` | 书签图标字段 | 幂等增量 |
| `014_nav_itab_data.sql` | iTab 备份数据导入 | **只在 022 之前跑**（脚本内含 `nav_setting` 兼容建表段）；详见 `README-014-nav-data.md` |
| `015_*` / `017` / `018` / `019` / `020` | 头像 / 会话校验 / 模型类型 / 业务空间 / 模态 | 幂等增量 |
| `016_observability.sql` | 监控四表 | 幂等 |
| `021_knowledge_folder.sql` | 知识库目录树 | 幂等 |
| `022_user_setting.sql` | **用户偏好统一表** + 迁移 `nav_setting` + `DROP nav_setting` | 幂等；全部为纯语句（无 `DO $$` 块），整文件执行 / 逐句执行（按 `;` 切分，如 JDK `ApplySql.java`、DBeaver 脚本）结果一致；`DROP` 不可逆，执行前先备份 `nav_setting` |

新增「用户偏好」时：在 `user_setting` 上 `ALTER TABLE ADD COLUMN`，并新建 `023_xxx.sql` 这类增量脚本，**不要修改已执行过的脚本**。
