-- =============================================================================
-- 022_user_setting.sql  ·  用户偏好统一表（取代 nav_setting）
-- -----------------------------------------------------------------------------
-- 背景：nav_setting 是「一人一行、只为放 3 个导航偏好」的专属表；每新增一类
--       按用户保存的偏好就要再建一张结构几乎相同的表。
--       本脚本建立统一表 user_setting，把 nav_setting 三列迁入后 DROP nav_setting。
-- 约定：user_setting 只存「用户偏好/设置」（标量、可丢失）。
--       业务数据（知识库文档、对话消息、DB 连接等）不进本表，各自建表并带 owner_id。
-- 演进：以后新增偏好 = ALTER TABLE user_setting ADD COLUMN + 实体/视图/patch 加字段
--       + 业务服务调 UserSettingService，不再新建表。
-- 幂等：重复执行安全（INSERT ... ON CONFLICT DO NOTHING + 建表守卫 + DROP IF EXISTS）。
-- 顺序：在 021 之后执行（docs/sql/README）。
--
-- 2026-11-16 修订（第 2 段改写为纯语句）：
--   原版第 2 段用 DO $$ ... $$ 包住迁移。逐句执行（按英文分号切分语句）的客户端会把
--   $$ 块从中间切开，报 `ERROR: unterminated dollar-quoted string at or near "$$"`，
--   迁移全程没执行，库停在「user_setting 已建好但为空、nav_setting 还在」的半截状态
--   （前面的 CREATE TABLE / COMMENT / CREATE INDEX 都是自动提交的，所以表在、数据不在）。
--   现改为「守卫建壳 → INSERT → DROP IF EXISTS」三句纯 SQL：整文件执行、逐句执行、
--   psql --single-transaction 三种方式结果一致；同时在前面加了可选的备份语句（默认注释）。
-- =============================================================================

-- 1. 统一表
CREATE TABLE IF NOT EXISTS user_setting (
    user_id               BIGINT       PRIMARY KEY REFERENCES app_user(id) ON DELETE CASCADE,
    search_engine         VARCHAR(16)  NOT NULL DEFAULT 'baidu',  -- baidu / google / bing（服务层白名单校验）
    current_wallpaper_key VARCHAR(256) NULL,                      -- 锁定壁纸 S3 key；NULL = 每次随机
    active_category_id    BIGINT       NULL,                      -- 上次选中的导航分类
    created_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ  NOT NULL DEFAULT now()
);

COMMENT ON TABLE  user_setting IS '用户偏好/设置统一表（一人一行；新增偏好只加列不加表）';
COMMENT ON COLUMN user_setting.search_engine         IS '默认搜索引擎（baidu/google/bing）';
COMMENT ON COLUMN user_setting.current_wallpaper_key IS '锁定的壁纸 S3 key；NULL=每次随机';
COMMENT ON COLUMN user_setting.active_category_id    IS '上次选中的分类（进入首页恢复）';

-- 壁纸当前值的反查/清理走这张表，加部分索引（NULL 行不占空间）
CREATE INDEX IF NOT EXISTS idx_user_setting_wallpaper
    ON user_setting (current_wallpaper_key)
    WHERE current_wallpaper_key IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 2. 迁移 nav_setting → user_setting，然后删旧表
-- -----------------------------------------------------------------------------

-- 2.0 备份（可选，DROP 不可逆）：需要留底时手工取消注释再执行，确认无误后可删掉备份表
-- CREATE TABLE IF NOT EXISTS nav_setting_bak_022 AS SELECT * FROM nav_setting
-- （注意：备份语句故意不写结尾分号，取消注释后需自行补上，避免分号落在注释里被切句器误切）

-- 2.1 守卫：nav_setting 不存在时（全新库 / 已迁移过的库）先建一个空壳，保证后面两句可执行。
--     空壳没有任何数据，最后与旧表一起 DROP，不会留下残渣。
CREATE TABLE IF NOT EXISTS nav_setting (
    user_id               BIGINT       PRIMARY KEY REFERENCES app_user(id),
    search_engine         VARCHAR(16)  NOT NULL DEFAULT 'baidu',
    current_wallpaper_key VARCHAR(256) NULL,
    active_category_id    BIGINT       NULL,
    updated_at            TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- 2.2 迁移数据：user_setting 已有该用户的行时保留现有值（ON CONFLICT DO NOTHING）
INSERT INTO user_setting (user_id, search_engine, current_wallpaper_key,
                          active_category_id, created_at, updated_at)
SELECT ns.user_id,
       COALESCE(NULLIF(ns.search_engine, ''), 'baidu'),
       ns.current_wallpaper_key,
       ns.active_category_id,
       now(),
       COALESCE(ns.updated_at, now())
  FROM nav_setting ns
ON CONFLICT (user_id) DO NOTHING;

-- 2.3 删旧表（含 2.1 建的空壳）。DROP 不可逆，线上执行前先按 2.0 备份。
DROP TABLE IF EXISTS nav_setting;
