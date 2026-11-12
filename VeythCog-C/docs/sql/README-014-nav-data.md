# 014 导航数据 SQL 入库说明

脚本：`VeythCog-C/docs/sql/014_nav_itab_data.sql`

内容：7 个分类、267 条书签（238 条 upload、18 条 text、11 条 auto），每条带 `icon_key` / `icon_text` / `icon_color`，可直接在线上库执行。

## 执行顺序

1. 确认线上库已有 `app_user` 表、且存在目标用户（默认 `admin`，由后端 DataInitializer 种子）。
2. 确认 `public-icons` 桶里已有 SQL 中引用的 `icon_key` 对象。SQL 只写数据库引用，不负责上传图片。
3. 备份三张表：

```bash
pg_dump -h <host> -p 5432 -U <user> -d <db> \
  -t nav_category -t nav_bookmark -t nav_setting > nav-before-014.sql
```

4. 执行：

```bash
psql -h <host> -p 5432 -U <user> -d <db> -v ON_ERROR_STOP=1 -f 014_nav_itab_data.sql
```

5. 脚本末尾会输出分类书签数和 `icon_type` 分布，清单部分预期为 7 / 267。

## 说明

- 目标用户默认 `admin`；线上用户名不同时，把 SQL 中所有 `username = 'admin'` 替换成实际用户名。用户不存在时脚本会直接报错，不会静默插入 0 行。
- 脚本自带 schema 自愈：`012_nav.sql` 只跑过旧版（P0，没有图标列）、`013_nav_bookmark_icon.sql` 没跑，都能直接执行——脚本会先 `CREATE TABLE IF NOT EXISTS` + `ALTER ... ADD COLUMN IF NOT EXISTS` 补齐，再写数据。
- 幂等：分类按 `(user_id, name, deleted = false)` 判重，书签按 `(user_id, category_id, url, deleted = false)` 判重，重复执行不会重复插入。
- 不会删除线上已有分类或书签；同 URL 的已有书签会同步 `icon_type / icon_key / icon_text / icon_color`，不覆盖标题、分类和排序。

## 2026-11-12 修订记录（线上执行报错的原因）

原版脚本把源数据装进 `CREATE TEMP TABLE nav_category` / `nav_bookmark`，与真实表同名。PostgreSQL 解析未限定表名时 `pg_temp` 优先于 `search_path`，于是后面的写库语句全部打到临时表，报：

```
ERROR: column "user_id" of relation "nav_category" does not exist
```

这跟"本地库和线上库字段不一致"无关，是脚本自身的表名遮蔽问题。本次修订：

1. 临时表改名 `v_itab_category` / `v_itab_bookmark`，消除遮蔽；
2. 分类补齐从 `JOIN nav_category v ON TRUE`（真实表笛卡尔积）改为 `CROSS JOIN` 临时清单 + `NOT EXISTS`；
3. 内联 012 最终版建表与 013 的补列语句，兼容未升级的线上库；
4. 增加目标用户、基础列的前置体检，缺什么直接给中文报错；
5. 图标同步 UPDATE 补 `deleted = FALSE`。

## 实测结果（2026-11-12，临时 PostgreSQL 16 实例）

| 场景 | 结果 |
| --- | --- |
| 012 已跑、图标列被移除（等价没跑 013），直接执行 014 | exit 0，自愈补回 5 列；7 分类 / 267 书签 |
| 012 + 013 全新建库后执行 | exit 0；7 分类 / 267 书签 |
| 连 012 都没跑（nav 表不存在） | exit 0，自动建表；7 / 267 |
| 同一库连续执行两次 | 第二次 `INSERT 0 0` / `UPDATE 0`，数量不变 |
| 重复 `(category_id, url)` 行 | 0 |
| icon_type 分布 | upload 238 / text 18 / auto 11；upload 缺 icon_key 为 0 |
