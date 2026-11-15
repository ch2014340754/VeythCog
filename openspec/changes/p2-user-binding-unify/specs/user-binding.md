# spec · 用户设置统一存储（user-binding-unify）

## 能力：`user-setting`

### 行为契约

1. **一人一份**
   - 系统内每个登录用户最多一条 `user_setting` 记录，主键 `user_id`。
   - 记录不存在时，读取返回默认视图（`search_engine=baidu`，`current_wallpaper_key/active_category_id=null`），且**不产生**新行。
   - 首次写入（任一字段）时创建该行。

2. **读取**
   - `GET /user/setting` 只返回当前登录用户的数据，泄漏他人数据视为缺陷。
   - 未登录访问返回 `401`（现有 `NOT_LOGIN_ERROR` 语义）。

3. **写入**
   - `PUT /user/setting` 只影响当前登录用户；不允许通过参数指定他人 `userId`。
   - 请求字段为 `null` 或省略 → 该字段保持不变。
   - `clear` 数组中的字段 → 置 `NULL`；`clear` 中出现未知字段名 → 业务码 `40000`。
   - `searchEngine` 取值为 `baidu|google|bing` 之外 → `40000`。
   - 成功返回 `code=0`，并在后续读取中反映新值。

4. **导航域消费**
   - `GET /nav/bootstrap` 返回的 `setting` 与 `GET /user/setting` 的 `data` **同源**（同一行、同一字段），不得出现两套值。
   - 壁纸锁定/解锁仍通过 `PUT /nav/wallpaper/lock`，落库到 `user_setting.current_wallpaper_key`；`key=null` 表示解锁（下次进首页随机）。

5. **表结构演进**
   - 新增用户偏好只允许「`user_setting` 加列 + 实体/视图/patch 加字段 + 业务服务调用 `UserSettingService`」，禁止为此新建表。
   - `user_setting` 只存偏好，不允许存业务数据（文档、消息、连接记录等）。

6. **旧表退场**
   - 迁移完成后 `nav_setting` 不再存在；后端代码中不得残留对 `nav_setting` / `NavSetting` 实体的读写。

### 验收标准

| # | 场景 | 期望 |
|---|---|---|
| A1 | 迁移前 A 用户 `search_engine=google`、锁定壁纸 K、`active_category_id=12` | 迁移后 `GET /user/setting` 三项完全一致 |
| A2 | 迁移脚本重复执行 | 不报错、不重复插入、不覆盖新值 |
| A3 | 第二个账号登录 | 返回 `baidu` + `null` + `null`，看不到 A 的壁纸与分类 |
| A4 | `PUT {"searchEngine":"bing"}` | 回读为 `bing`；`activeCategoryId` 不变 |
| A5 | `PUT {"clear":["activeCategoryId"]}` | 回读 `activeCategoryId=null` |
| A6 | `PUT {"clear":["notExistField"]}` | `40000`，数据不变 |
| A7 | `PUT {"searchEngine":"sogou"}` | `40000`，数据不变 |
| A8 | 首页加载 | `bootstrap.setting` 与 `GET /user/setting` 值一致；搜索引擎/分类/壁纸与改造前一致 |
| A9 | 未登录调用 `/user/setting` | `401` |
| A10 | 库表检查 | `nav_setting` 不存在；`user_setting` 行数 ≥ 迁移前 `nav_setting` 行数 |

### 回归场景（必须跑）

- 首页：切换分类后刷新页面仍回到该分类（`active_category_id` 生效）。
- 壁纸：锁定一张壁纸 → 刷新仍在；解除锁定 → 刷新随机。
- 登录/登出：登出再登录，设置不丢。
- `mvn -q -DskipTests compile`、`npm run build` 均通过。
