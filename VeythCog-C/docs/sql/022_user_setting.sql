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
-- 幂等：重复执行安全（INSERT ... ON CONFLICT DO NOTHING + to_regclass 守卫）。
-- 顺序：在 021 之后执行（docs/sql/README）。
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

-- 2. 迁移 nav_setting → user_setting，然后删旧表
DO $$
DECLARE
    migrated INTEGER := 0;
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

        SELECT count(*) INTO migrated FROM user_setting;

        DROP TABLE nav_setting;
        RAISE NOTICE 'nav_setting 已迁移并删除；user_setting 现有 % 行', migrated;
    ELSE
        RAISE NOTICE 'nav_setting 不存在（已迁移或全新库），跳过迁移';
    END IF;
END $$;
