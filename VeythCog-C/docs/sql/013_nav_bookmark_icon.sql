-- =============================================================================
-- 013_nav_bookmark_icon.sql · 导航书签图标资产化（P2 · 2026-11-12）
-- -----------------------------------------------------------------------------
-- 环境：PostgreSQL 15/16；前置：012_nav.sql 已执行（nav_bookmark 表存在）。
-- 作用：给 nav_bookmark 补图标来源字段，图标统一存 S3 public-icons。
--   icon_type      auto 站点抓取 / upload 自定义上传 / text 文字图标
--   icon_key       public-icons 对象 key（icons/yyyy/MM/dd/uuid.ext）
--   icon_text      文字图标内容（1~3 字符）
--   icon_color     文字图标底色 #RRGGBB
--   icon_synced_at 最近一次抓取时间（成功/失败都写，失败按 1 天冷却重试）
-- 幂等：全部使用 IF NOT EXISTS，可重复执行。
-- =============================================================================

ALTER TABLE nav_bookmark
    ADD COLUMN IF NOT EXISTS icon_type      VARCHAR(16) NOT NULL DEFAULT 'auto',
    ADD COLUMN IF NOT EXISTS icon_key       VARCHAR(256) NULL,
    ADD COLUMN IF NOT EXISTS icon_text      VARCHAR(16) NULL,
    ADD COLUMN IF NOT EXISTS icon_color     VARCHAR(16) NULL,
    ADD COLUMN IF NOT EXISTS icon_synced_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN nav_bookmark.icon_type IS '图标来源：auto 站点抓取 / upload 自定义上传 / text 文字图标';
COMMENT ON COLUMN nav_bookmark.icon_key  IS 'public-icons 桶对象 key；为空表示尚未同步到 S3';
COMMENT ON COLUMN nav_bookmark.icon_text IS '文字图标内容（1~3 字符）';
COMMENT ON COLUMN nav_bookmark.icon_color IS '文字图标底色（#RRGGBB）';
COMMENT ON COLUMN nav_bookmark.icon_synced_at IS '最近一次站点图标抓取时间（成功/失败都写，失败按 1 天冷却重试）';

-- icon_type 取值约束（PostgreSQL 不支持 ADD CONSTRAINT IF NOT EXISTS，用 DO 块判重）
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ck_nav_bookmark_icon_type'
          AND conrelid = 'nav_bookmark'::regclass
    ) THEN
        ALTER TABLE nav_bookmark
            ADD CONSTRAINT ck_nav_bookmark_icon_type
            CHECK (icon_type IN ('auto', 'upload', 'text'));
    END IF;
END $$;
