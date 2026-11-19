-- =============================================================================
-- 025_user_setting_home_view.sql · 首页默认视图偏好
-- -----------------------------------------------------------------------------
-- 背景：/home 新增「今日 / 导航」双视图，需要按用户记住上次选择。
-- 约定：遵循 022_user_setting.sql「一人一行、加列不加表」，不新建表。
-- 幂等：ADD COLUMN IF NOT EXISTS；重复执行安全。
-- 顺序：在 024_clip.sql 之后执行。
-- =============================================================================

ALTER TABLE user_setting
    ADD COLUMN IF NOT EXISTS home_view VARCHAR(16) NOT NULL DEFAULT 'today';

COMMENT ON COLUMN user_setting.home_view IS '首页默认视图：today / nav（服务层白名单校验，非法值按 today 处理）';
