-- 015_app_user_avatar.sql · 用户头像绑定
-- 执行顺序：在 app_user 建表（003）之后执行
--
-- 设计说明：
--   · 只保存 S3 对象 key，不保存完整 URL；
--   · 展示时由后端按 storage.s3.public-endpoint 生成 public-icons 桶公开直链，
--     避免公网域名调整后库里旧地址全部失效；
--   · 头像对象统一放在 public-icons/avatars/{userId}/ 下，便于按用户清理。

ALTER TABLE app_user
    ADD COLUMN IF NOT EXISTS avatar_key VARCHAR(512) NOT NULL DEFAULT '';

COMMENT ON COLUMN app_user.avatar_key IS '头像 S3 对象 key，例如 avatars/12/2026/11/12/xxx.png';
