-- =============================================================
-- 007_app_user_role_status.sql · 用户表增加「角色」与「状态」列
-- 环境：PostgreSQL（Supabase）
-- 迁移要点：
--   · 后端 ddl-auto=none，需手动执行本脚本后再启动后端，否则查询 role/status 列会报错。
--   · 现有 admin 行置为 role='admin'；其余行默认 role='user'、status='active'。
-- =============================================================

ALTER TABLE app_user
    ADD COLUMN IF NOT EXISTS role   VARCHAR(16) NOT NULL DEFAULT 'user',
    ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'active';

UPDATE app_user SET role = 'admin' WHERE username = 'admin';

COMMENT ON COLUMN app_user.role   IS '角色: admin/user';
COMMENT ON COLUMN app_user.status IS '状态: active/disabled';
