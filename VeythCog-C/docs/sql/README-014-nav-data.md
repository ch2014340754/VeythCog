# 014 导航数据 SQL 入库说明

脚本：`VeythCog-C/docs/sql/014_nav_itab_data.sql`

内容：7 个分类、267 条书签（238 条 upload、18 条 text、11 条 auto），每条带 `icon_key` / `icon_text` / `icon_color`，可直接在线上库执行。

## 执行顺序

1. 确认线上已执行过 `012_nav.sql`、`013_nav_bookmark_icon.sql`。
2. 确认 `public-icons` 桶里已有 SQL 中引用的 `icon_key` 对象。SQL 只写数据库引用，不负责上传图片。
3. 备份三张表：

```bash
pg_dump -h <host> -p 5432 -U <user> -d <db> \
  -t nav_category -t nav_bookmark -t nav_setting > nav-before-014.sql
```

4. 执行：

```bash
psql -h <host> -p 5432 -U <user> -d <db> -f 014_nav_itab_data.sql
```

5. 脚本末尾会输出分类书签数和 `icon_type` 分布，预期为 267 条。

## 说明

- 目标用户默认 `admin`；线上用户名不同时，把 SQL 中所有 `username = 'admin'` 替换成实际用户名。
- 幂等：分类按 `(user_id, name)` 判重，书签按 `(category_id, url)` 判重，重复执行不会重复插入。
- 不会删除线上已有分类或书签；同 URL 的已有书签会同步 `icon_type / icon_key / icon_text / icon_color`，不覆盖标题、分类和排序。
- 已在隔离 schema 中实测：首次插入 7 分类 / 267 书签，第二次仍为 7 / 267；手动清空某条图标后再执行，图标被正确补回。
