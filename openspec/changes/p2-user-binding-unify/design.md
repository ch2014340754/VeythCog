# design · p2-user-binding-unify：统一用户设置表 `user_setting`

## 1. 表结构（PostgreSQL，`docs/sql/022_user_setting.sql`）

一人一行，`user_id` 即主键；行不存在 = 全默认值（读时兜底，不写库），与现 `nav_setting` 行为一致。

```sql
CREATE TABLE IF NOT EXISTS user_setting (
    user_id               BIGINT       PRIMARY KEY REFERENCES app_user(id) ON DELETE CASCADE,
    search_engine         VARCHAR(16)  NOT NULL DEFAULT 'baidu',  -- baidu / google / bing（服务层白名单校验）
    current_wallpaper_key VARCHAR(256) NULL,                      -- 锁定壁纸 S3 key；NULL = 随机
    active_category_id    BIGINT       NULL,                      -- 上次选中的导航分类
    created_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ  NOT NULL DEFAULT now()
);

COMMENT ON TABLE  user_setting IS '用户偏好/设置统一表（一人一行，新增偏好只加列不加表）';
COMMENT ON COLUMN user_setting.search_engine         IS '默认搜索引擎（baidu/google/bing）';
COMMENT ON COLUMN user_setting.current_wallpaper_key IS '锁定壁纸 S3 key；NULL=随机';
COMMENT ON COLUMN user_setting.active_category_id    IS '上次选中的导航分类（进入首页恢复）';

-- 壁纸当前用户查询是热路径（bootstrap 每次进首页都会读），加部分索引便于按 key 反查/清理
CREATE INDEX IF NOT EXISTS idx_user_setting_wallpaper
    ON user_setting (current_wallpaper_key) WHERE current_wallpaper_key IS NOT NULL;
```

### 1.1 迁移 + 删表（同一脚本内，幂等）

```sql
DO $$
BEGIN
    IF to_regclass('nav_setting') IS NOT NULL THEN
        INSERT INTO user_setting (user_id, search_engine, current_wallpaper_key,
                                  active_category_id, created_at, updated_at)
        SELECT user_id,
               COALESCE(NULLIF(search_engine, ''), 'baidu'),
               current_wallpaper_key,
               active_category_id,
               now(),
               COALESCE(updated_at, now())
          FROM nav_setting
        ON CONFLICT (user_id) DO NOTHING;

        DROP TABLE nav_setting;
        RAISE NOTICE 'nav_setting 已迁移并删除';
    ELSE
        RAISE NOTICE 'nav_setting 不存在（已迁移或新库），跳过';
    END IF;
END $$;
```

- `ON CONFLICT DO NOTHING`：重复执行不会用旧表数据覆盖新表（迁移只发生一次）。
- `to_regclass` 守卫：老库执行一次即删表；新库（只跑过 022 之前的脚本）也能安全跳过。
- `012_nav.sql` 保持不动（历史脚本不追改），仅在文件头加一行「nav_setting 已被 022_user_setting.sql 取代」注释；`docs/sql/README` 记录执行顺序 `... 021 → 022`。

## 2. 为什么是「宽表 + 加列」，不是 KV 表

| 方案 | 优点 | 缺点 | 结论 |
|---|---|---|---|
| A. 一人一行宽表（选定） | 强类型、可加 NOT NULL/默认值、可建部分索引、单行读一次拿全、MyBatis-Plus 一条 `selectById`；新增偏好 = `ALTER TABLE ADD COLUMN`（PG 只改元数据，毫秒级） | 字段多了表会变宽（个人项目量级可接受） | ✅ 采用 |
| B. KV 表 `(user_id, setting_key, setting_value jsonb)` | 新增偏好零 DDL | 类型全丢（每处读都要自己判型/兜底）、无默认值约束、一次读要 group 拼装、无法建强索引、脏 key 无法清理 | ❌ 不采用：省下的 DDL 抵不上校验与查询成本 |
| C. JSONB 文档列 `settings jsonb` | 零 DDL、结构灵活 | 字段名写错不报错、历史版本兼容全靠代码、迁移无法 SQL 表达 | ❌ 不采用：个人项目最怕静默写错字段 |

**边界（必须守住）**：本表只放**用户偏好/设置**（标量、小、可丢失）。业务数据（知识库文档、对话消息、DB 连接等）**不进本表**，各自建表并带 `owner_id`——否则无法做行级权限、无法按用户清理、无法做业务查询。

## 3. 后端模块归属

新增模块 `vc-user`（`com.vc.user`），依赖方向：`vc-common ← vc-user ← (vc-nav, 未来其它域) ← vc-app`。

```
vc-user/
├── pom.xml                       # vc-common + mybatis-plus starter + postgresql
└── src/main/java/com/vc/user/setting/
    ├── UserSetting.java          # @TableName("user_setting")，@TableId userId
    ├── UserSettingMapper.java    # BaseMapper<UserSetting>
    ├── UserSettingService.java    # get / patch / updateWallpaperKey
    └── dto/
        ├── UserSettingView.java   # 下发结构（字段名与旧 NavSetting 一致）
        └── UserSettingPatch.java  # 更新结构（null=不改 + clear 显式清空）
```

- 实体用 MyBatis-Plus（与 `vc-nav` 一致），不引 JPA；`updated_at` 由 Service 显式 `OffsetDateTime.now()` 写入（与现 `nav_setting` 一致，不依赖数据库触发器）。
- `vc-user` 现在只有 setting 包；未来把 `User` / `Role` 从 `vc-app` 抽出时并入本模块（与 `PROJECT_MEMORY.md` §3.1 记录的方向一致）。
- `VcAppApplication` 的 `@MapperScan` 增加 `"com.vc.user.setting"`。

## 4. 接口契约（context-path `/api`，均需登录）

### 4.1 新增：`GET /user/setting`

```json
{
  "code": 0,
  "data": {
    "userId": 1,
    "searchEngine": "baidu",
    "currentWallpaperKey": null,
    "activeCategoryId": 12,
    "updatedAt": "2026-11-15T20:11:03+08:00"
  }
}
```

行不存在时返回默认视图（`searchEngine=baidu`、其余 null），**不落库**。

### 4.2 新增：`PUT /user/setting`（唯一写入口）

```json
{
  "searchEngine": "bing",          // 省略 / null = 不修改
  "activeCategoryId": 12,          // 省略 / null = 不修改
  "clear": ["activeCategoryId"]    // 显式置 NULL 的字段白名单（目前支持 activeCategoryId、currentWallpaperKey）
}
```

- 未知字段名进 `clear` → `40000`；未知 `searchEngine` 值 → `40000`（白名单 `baidu/google/bing`）。
- 语义固定为「**null = 不改，clear = 清空**」，避免重演「`activeCategoryId:null` 到底是不改还是清空」的歧义。后续每加一列，`patch` 与 `clear` 两处白名单同步加。

### 4.3 移除：`GET /nav/setting`、`PUT /nav/setting`

导航域不再持有「用户设置」语义；前端改调 `/user/setting`（见 §6）。

### 4.4 保留：`GET /nav/bootstrap`

`setting` 字段由 `NavSetting` 改为 `UserSettingView`（**字段名不变**，`NavBootstrap` 的 TS 类型无需改结构），其余 `categories / activeCategoryId / bookmarks / wallpaper` 不变。

### 4.5 保留：`PUT /nav/wallpaper/lock`

壁纸锁定仍走本接口（含 `key: null` 解锁 + S3 对象校验），内部改为写 `user_setting.current_wallpaper_key`。`GET /nav/wallpaper/current` 只读 `user_setting`。

## 5. 「以后新增用户偏好」的标准动作（3 步）

1. **加列**：`ALTER TABLE user_setting ADD COLUMN <name> <type> NULL;` + 追加到 `022` 之后的下一个迁移脚本（不要改已执行脚本）。
2. **加字段**：`UserSetting` 实体加字段；`UserSettingView` 加下发字段；`UserSettingPatch` 加可选字段并登记进 `clear` 白名单。
3. **接业务**：业务服务只调 `UserSettingService.get/patch`，不自己写 SQL；前端只调 `/user/setting`。

不需要新建表，不需要新建 Mapper。

## 6. 前端改动（最小面）

| 文件 | 改动 |
|---|---|
| `src/api/user.ts`（新建） | `getUserSetting()` → `GET /user/setting`；`updateUserSetting(patch)` → `PUT /user/setting` |
| `src/api/nav.ts` | 删除 `getNavSetting` / `updateNavSetting`；`NavSetting` 接口保留（字段与新视图一致，供 `NavBootstrap` 复用） |
| `src/stores/navStore.ts` | L11-12 改 import；`setSearchEngine` / `setActiveCategory` / `loadSetting` 改调 `user.ts`（其余缓存与静默刷新逻辑不动） |

前端不新增 loading 态：沿用「静默刷新 + 细进度条」规范，写入失败仍 `catch` 忽略（与现行为一致）。壁纸相关（`wallpaperStore`、`Settings/Appearance.tsx`）零改动。

## 7. 风险与回滚

| 风险 | 处理 |
|---|---|
| 迁移漏行导致壁纸/分类丢失 | `022` 先建表再迁移，`ON CONFLICT DO NOTHING`；执行前 `SELECT count(*) FROM nav_setting`，执行后 `SELECT count(*) FROM user_setting` 比对；DROP 前 30 秒内可 `pg_dump -t nav_setting` 备份 |
| `DROP TABLE` 不可逆 | 脚本内先 `RAISE NOTICE` 提示；开发库执行前按 `docs/sql/README` 备份三表 |
| 前端仍打 `/nav/setting` | 该接口已删除，404 → 前端 `catch` 静默（不阻断首页）；同批改前端，不留死调用 |
| 新模块漏 `@MapperScan` | 启动即 `NoSuchBeanDefinitionException`，属显性失败；tasks 里列为验证项 |
| 未来有人往 `user_setting` 塞业务数据 | 在 `PROJECT_MEMORY.md` §5 表说明里写明边界（只放偏好，不放业务数据） |

## 9. 落地记录（2026-11-15）

迁移与代码均按本设计执行，无方案偏离。开发库（111.230.146.233 / veyth_cog）实测：

- 迁移前 `nav_setting` 仅 1 行（admin id=1：baidu / v-27.mp4 / 13），已留快照。
- 执行 `022_user_setting.sql` 后 `to_regclass('nav_setting')` 为 NULL、`user_setting` 存在，admin 行三列原值一致；复跑一次仍成功（幂等，行数不变）。
- 后端 `mvn -DskipTests package` 通过（jar 100,737,781 字节）；`@MapperScan` 生效，启动 `healthy`。
- 接口真机验证：`GET /user/setting` 与 `GET /nav/bootstrap` 的 setting 完全一致；PUT bing / 大写 BAIDU / 非法 sogou / clear activeCategoryId / clear 未知字段 / 恢复原值均符合契约；未登录 401；临时探针账号读到默认视图、无 admin 数据泄漏（验证后已删除）；`GET|PUT /nav/setting` 均 404；壁纸解锁→重锁回环后恢复 v-27.mp4（预签名 URL、kind=video）。
- 前端 `npm run build`（tsc + vite）通过；`src` 内 `nav/setting`、`getNavSetting`、`updateNavSetting` 残留为 0。
- 文档同步：`PROJECT_MEMORY.md` §3.1/§3.2/§5/§6/§8.3、`docs/sql/README.md`、`audit.md` §1 第 6 条、`tasks.md` 勾选。

