-- =============================================================================
-- 012_nav.sql · 导航首页模块建表脚本（P1 · iTab 风格新标签页）
-- -----------------------------------------------------------------------------
-- 环境：PostgreSQL 16（个人服务器 docker 容器，与知识库同库）
-- 前置：app_user 表已存在（003_app_user.sql）；本脚本不依赖 pgvector。
-- 表：
--   nav_category  分类表（主页 / 后端 / 前端 / 学习 / 工具 / 游戏 / AI）
--   nav_bookmark  书签表（每分类下的常用网站，图标存 S3 public-icons）
--   nav_setting   用户首页配置表（一人一行：搜索引擎 / 锁定壁纸 / 上次分类）
-- 注意：ddl-auto=none，需对目标库执行本脚本后导航首页功能才生效。
-- -----------------------------------------------------------------------------
-- 拍板记录（2026-11-10，图标策略于 2026-11-12 由 P2 变更）：
--   ① 入口：/home 独立入口；/ 302 到 /home；工作台 logo 点击也跳 /home。
--   ② 滚轮热区：覆盖整个图标页面区域（书签网格主区域），不依赖右侧竖栏可见。
--   ③ 右侧竖栏：平时隐藏，鼠标靠近右边缘 20px 热区滑入，离开 1.5s 滑出。
--   ④ favicon：~~前端直接拼 https://{host}/favicon.ico~~ → 已改为后端抓取并同步到
--      S3 public-icons（icon_type/icon_key），前端缓存优先；自定义上传与文字图标也走 S3。
--      旧库执行 013_nav_bookmark_icon.sql 补齐列。
--   ⑤ 壁纸：P0 从 S3 wallpapers 桶预放 20 张，不做上传（后期再做管理功能）。
--   ⑥ 分类删除：分类下有书签时不支持删除（前端禁用 + 后端 409）；不做迁移逻辑。
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. 分类表 nav_category
--    软删除：deleted 标记；唯一约束 (user_id, name) 仅对未删除行生效。
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nav_category (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT       NOT NULL REFERENCES app_user(id),
    name        VARCHAR(32)  NOT NULL,
    icon        VARCHAR(128) NOT NULL DEFAULT '',     -- 分类图标（P0 用 emoji，如 🏠 </>）
    sort_order  INT          NOT NULL DEFAULT 0,      -- 排序值，越小越靠前
    is_default  BOOLEAN      NOT NULL DEFAULT FALSE,  -- 是否默认分类（每用户至多 1 个）
    deleted     BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

COMMENT ON TABLE  nav_category IS '导航分类表（iTab 右侧竖栏）';
COMMENT ON COLUMN nav_category.icon       IS '分类图标（P0 用 emoji；后期可扩展为 S3 key）';
COMMENT ON COLUMN nav_category.sort_order IS '排序值，越小越靠前';
COMMENT ON COLUMN nav_category.is_default IS '是否默认分类（应用层保证每用户至多 1 个 true）';
COMMENT ON COLUMN nav_category.deleted   IS '软删除标记';

-- 部分唯一索引：同一用户下分类名不重复（仅未删除行）
CREATE UNIQUE INDEX IF NOT EXISTS uk_nav_category_user_name
    ON nav_category(user_id, name) WHERE deleted = FALSE;

-- 查询索引：按用户查所有分类
CREATE INDEX IF NOT EXISTS idx_nav_category_user_deleted
    ON nav_category(user_id, deleted, sort_order);

-- -----------------------------------------------------------------------------
-- 2. 书签表 nav_bookmark
--    图标统一存 S3 public-icons（013 起）；icon_type 区分站点抓取 / 自定义上传 / 文字图标。
--    软删除：deleted 标记；分类删除时若该分类下有书签，后端返回 409 拒绝删除。
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nav_bookmark (
    id          BIGSERIAL PRIMARY KEY,
    category_id BIGINT       NOT NULL REFERENCES nav_category(id),
    user_id     BIGINT       NOT NULL REFERENCES app_user(id),  -- 冗余，便于按用户查询
    title       VARCHAR(64)  NOT NULL,               -- 显示名（GitHub / MDN / React）
    url         VARCHAR(512) NOT NULL,               -- 跳转地址（仅 http/https）
    -- 图标（013 起统一存 S3 public-icons；见 013_nav_bookmark_icon.sql）
    icon_type   VARCHAR(16)  NOT NULL DEFAULT 'auto',-- auto 站点抓取 / upload 自定义上传 / text 文字图标
    icon_key    VARCHAR(256) NULL,                   -- public-icons 对象 key
    icon_text   VARCHAR(16)  NULL,                   -- 文字图标内容（1~3 字符）
    icon_color  VARCHAR(16)  NULL,                   -- 文字图标底色 #RRGGBB
    icon_synced_at TIMESTAMPTZ NULL,                 -- 最近一次抓取尝试时间（失败冷却用）
    sort_order  INT          NOT NULL DEFAULT 0,     -- 分类内排序
    deleted     BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

COMMENT ON TABLE  nav_bookmark IS '导航书签表（分类下的常用网站）';
COMMENT ON COLUMN nav_bookmark.category_id IS '所属分类（FK→nav_category.id）';
COMMENT ON COLUMN nav_bookmark.title       IS '显示名（图标下方文字）';
COMMENT ON COLUMN nav_bookmark.url        IS '跳转地址（后端校验仅 http/https）';
COMMENT ON COLUMN nav_bookmark.icon_type  IS '图标来源：auto 站点抓取 / upload 自定义上传 / text 文字图标';
COMMENT ON COLUMN nav_bookmark.icon_key   IS 'public-icons 桶对象 key；为空表示尚未同步到 S3';
COMMENT ON COLUMN nav_bookmark.icon_text  IS '文字图标内容（1~3 字符）';
COMMENT ON COLUMN nav_bookmark.icon_color IS '文字图标底色（#RRGGBB）';
COMMENT ON COLUMN nav_bookmark.icon_synced_at IS '最近一次站点图标抓取时间（成功/失败都写，失败按 1 天冷却重试）';
COMMENT ON COLUMN nav_bookmark.sort_order  IS '分类内排序值，越小越靠前';
COMMENT ON COLUMN nav_bookmark.deleted    IS '软删除标记';

-- 查询索引：按分类查书签（按 sort_order 升序）
CREATE INDEX IF NOT EXISTS idx_nav_bookmark_category_sort
    ON nav_bookmark(category_id, sort_order) WHERE deleted = FALSE;

-- 按用户查询索引
CREATE INDEX IF NOT EXISTS idx_nav_bookmark_user_deleted
    ON nav_bookmark(user_id, deleted);

-- -----------------------------------------------------------------------------
-- 3. 用户首页配置表 nav_setting（一人一行）
--    current_wallpaper_key：锁定的壁纸 S3 key；NULL = 每次进入首页随机。
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nav_setting (
    user_id              BIGINT       PRIMARY KEY REFERENCES app_user(id),
    search_engine        VARCHAR(16)  NOT NULL DEFAULT 'baidu',  -- baidu / google / bing
    current_wallpaper_key VARCHAR(256) NULL,                      -- 锁定壁纸 key；NULL=随机
    active_category_id   BIGINT       NULL,                      -- 上次选中的分类
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT now()
);

COMMENT ON TABLE  nav_setting IS '用户导航首页配置（一人一行）';
COMMENT ON COLUMN nav_setting.search_engine         IS '默认搜索引擎（baidu/google/bing）';
COMMENT ON COLUMN nav_setting.current_wallpaper_key IS '锁定的壁纸 S3 key；NULL=每次随机';
COMMENT ON COLUMN nav_setting.active_category_id    IS '上次选中的分类（进入首页恢复）';

-- =============================================================================
-- 种子数据（admin 用户）
--   admin 用户 id 从 app_user 表查（DataInitializer 已种子 admin/admin123）。
--   7 个分类：主页 🏠 / 后端 </> / 前端 🎨 / 学习 📚 / 工具 🛠 / 游戏 🎮 / AI ✨
--   每分类预置 2-3 个示例书签。
-- =============================================================================

-- 3.1 分类种子（sort_order 10/20/.../70，第一个「主页」为默认分类）
INSERT INTO nav_category (user_id, name, icon, sort_order, is_default)
SELECT u.id, v.name, v.icon, v.sort_order, v.is_default
FROM app_user u
CROSS JOIN (
    VALUES
        ('主页', '🏠', 10, TRUE),
        ('后端', '</>', 20, FALSE),
        ('前端', '🎨', 30, FALSE),
        ('学习', '📚', 40, FALSE),
        ('工具', '🛠', 50, FALSE),
        ('游戏', '🎮', 60, FALSE),
        ('AI',   '✨', 70, FALSE)
) AS v(name, icon, sort_order, is_default)
WHERE u.username = 'admin'
  AND NOT EXISTS (SELECT 1 FROM nav_category nc WHERE nc.user_id = u.id AND nc.name = v.name AND nc.deleted = FALSE);

-- 3.2 书签种子（每分类 2-3 个示例）
-- 注意：用子查询取分类 id，避免硬编码。
INSERT INTO nav_bookmark (user_id, category_id, title, url, sort_order)
SELECT u.id, nc.id, v.title, v.url, v.sort_order
FROM app_user u
JOIN nav_category nc ON nc.user_id = u.id AND nc.deleted = FALSE
CROSS JOIN (
    -- 主页
    VALUES
        ('主页', 'GitHub',       'https://github.com', 10),
        ('主页', '掘金',         'https://juejin.cn',  20),
        ('主页', '知乎',         'https://www.zhihu.com', 30),
    -- 后端
        ('后端', 'Stack Overflow', 'https://stackoverflow.com', 10),
        ('后端', 'Spring 官方',     'https://spring.io', 20),
        ('后端', 'MyBatis-Plus',    'https://baomidou.com', 30),
    -- 前端
        ('前端', 'MDN',           'https://developer.mozilla.org', 10),
        ('前端', 'React 官方',    'https://react.dev', 20),
        ('前端', 'Can I Use',     'https://caniuse.com', 30),
    -- 学习
        ('学习', '力扣',          'https://leetcode.cn', 10),
        ('学习', 'SegmentFault',  'https://segmentfault.com', 20),
    -- 工具
        ('工具', 'Google 翻译',   'https://translate.google.com', 10),
        ('工具', 'DeepL',         'https://www.deepl.com', 20),
    -- 游戏
        ('游戏', '剑网3 官网',    'https://jx3.xoyo.com', 10),
        ('游戏', 'Steam',         'https://store.steampowered.com', 20),
    -- AI
        ('AI',   '豆包',          'https://www.doubao.com', 10),
        ('AI',   'DashScope',     'https://dashscope.aliyun.com', 20)
) AS v(category_name, title, url, sort_order)
WHERE u.username = 'admin'
  AND nc.name = v.category_name
  AND NOT EXISTS (
      SELECT 1 FROM nav_bookmark nb
      WHERE nb.user_id = u.id AND nb.category_id = nc.id AND nb.url = v.url AND nb.deleted = FALSE
  );

-- 3.3 nav_setting 默认行（admin 一行，搜索引擎 baidu）
INSERT INTO nav_setting (user_id, search_engine)
SELECT u.id, 'baidu'
FROM app_user u
WHERE u.username = 'admin'
  AND NOT EXISTS (SELECT 1 FROM nav_setting ns WHERE ns.user_id = u.id);
