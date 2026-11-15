# proposal · p2-user-binding-unify

## 为什么

1. `nav_setting` 是一张「一人一行、只为放 3 个导航偏好」的表。每来一个需要按用户保存的偏好就得新建一张结构几乎相同的表（表名不同、列不同），用户明确要求收口。
2. 收口后新增用户偏好 = **加字段**，不再加表。
3. 审计（`audit.md`）发现：真正的归属缺失在**知识库（文档/目录）**和**对话消息**，而前端还有 6 类「账号数据只存浏览器」。

## 做什么（In scope）

1. 新建统一用户设置表 `user_setting`（一人一行，PK `user_id`）。
2. 新建后端模块 `vc-user`（`com.vc.user.setting`），承载实体 / Mapper / Service / View / Patch；它是**用户偏好**的唯一读写入口（后续 `User`/`Role` 抽出时并入本模块）。
3. `nav_setting` 三列数据迁移进 `user_setting`，**DROP `nav_setting`**；`vc-nav` 改为消费 `vc-user` 的 `UserSettingService`，删除 `NavSetting` 实体与 Mapper。
4. 接口收口：新增 `GET /user/setting`、`PUT /user/setting`（唯一写入口）；移除 `GET/PUT /nav/setting`；`GET /nav/bootstrap` 保留，`setting` 字段改为同一份 `UserSettingView`（字段名不变，前端读取逻辑不动）。
5. 前端 `navStore` / `api/nav.ts` 切换到 `/user/setting`（仅 2 处调用）。
6. 定义「新增用户偏好的标准动作」（3 步，见 design §5），写进 `PROJECT_MEMORY.md`，后续照做即可。

## 不做什么（Out of scope，另行立项）

- **知识库归属**（`knowledge_doc` / `knowledge_folder` 补 `owner_id` + 回填 + 全查询/检索过滤 + 目录 Service 补 `userId` 形参）：改动跨 21 个 SQL 与全部读写路径，且需要多账号数据判定策略（存量数据归谁），必须单独 propose。
- **对话消息归属**（`chat_message` 加 `user_id` + 去掉 `conversationId` 前缀）：涉及存量数据回填与记忆主键变更，单独 propose。
- **前端偏好上收**（模型偏好、主题、毛玻璃、工具收藏、搜索/翻译历史、飞书绑定、DB 连接）：本变更只把落点（表 + 接口 + 标准动作）建好，具体字段在各自功能迭代时按需加列并接入，避免一次性堆一堆没人写没人读的空列。
- 登出统一清理 persist store（另列 P2 小项，不在本变更）。

## 影响面

| 层 | 文件 |
|---|---|
| 建表 | 新增 `VeythCog-C/docs/sql/022_user_setting.sql`（建表 + 迁移 + DROP，幂等） |
| 新模块 | `VeythCog-C/vc-user/pom.xml` + `com.vc.user.setting/*`；根 `pom.xml` 加 `<module>` |
| 后端不再用 | `vc-nav/entity/NavSetting.java`、`vc-nav/mapper/NavSettingMapper.java`（删除）；`NavSettingService` 改为薄封装 |
| 后端改造 | `vc-nav/service/{NavSettingService, NavWallpaperService, NavBootstrapService}.java`、`vc-nav/dto/NavBootstrapView.java`、`vc-app/web/NavSettingController.java`、`vc-app/VcAppApplication.java`（MapperScan） |
| 新增接口 | `vc-app/web/UserSettingController.java` → `/user/setting` |
| 前端 | `VeythCog-V/src/api/nav.ts`、`src/api/user.ts`(新建)、`src/stores/navStore.ts` |
| 文档 | `PROJECT_MEMORY.md` §3/§5/§6/§8、`docs/sql/README`、`012_nav.sql` 头部加「已被 022 取代」注释 |

## 验收标准

1. 库上 `nav_setting` 不存在；`user_setting` 中每个原 `nav_setting` 行都有一条对应记录，`search_engine` / `current_wallpaper_key` / `active_category_id` 值一致（逐账号比对）。
2. 登录 admin → 首页：搜索引擎、上次分类、锁定壁纸**与改造前一致**（`GET /nav/bootstrap` 同一请求返回）。
3. 换第二个账号：`GET /user/setting` 返回该账号的默认视图（`baidu` + 空壁纸），壁纸/分类不串号。
4. `PUT /user/setting {"searchEngine":"bing"}` 后 `GET` 回读生效；`{"activeCategoryId":null}` 不修改（null=不改），清空语义用显式字段（见 design §4）。
5. 用只有 `search_engine` 一列的旧数据调用 `GET /nav/bootstrap`，`setting` 字段仍返回完整可读对象，不出现 `null` 字段缺失导致的前端报错。
6. 后端 `mvn -q -DskipTests compile` 通过；前端 `npm run build` 通过。
7. `PROJECT_MEMORY.md` §5 表清单里 `nav_setting` 换成 `user_setting`，并记录「新增偏好 3 步」。
