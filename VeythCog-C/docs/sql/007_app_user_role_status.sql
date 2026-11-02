-- =============================================================
-- 007_app_user_role_status.sql · 用户表增加「角色」与「状态」列
-- 环境：开发库 MySQL 5.7 (vc)；线上库 PostgreSQL（Supabase）
-- 迁移要点：
--   · 开发库为 MySQL → 执行「MySQL 段」；线上库为 PG → 执行「PostgreSQL 段」。
--   · 后端 ddl-auto=none，需手动执行本脚本后再启动后端，否则查询 role/status 列会报错。
--   · 现有 admin 行置为 role='admin'；其余行默认 role='user'、status='active'。
-- =============================================================

-- =============================================================
-- MySQL 段（开发库，jdbc:mysql://localhost:3306/vc）
-- =============================================================
ALTER TABLE app_user
    ADD COLUMN role   VARCHAR(16) NOT NULL DEFAULT 'user'   COMMENT '角色: admin/user' AFTER email,
    ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'active' COMMENT '状态: active/disabled' AFTER role;

-- 现有管理员账号标记为 admin 角色（其余保持默认 user）
UPDATE app_user SET role = 'admin' WHERE username = 'admin';


-- =============================================================
-- PostgreSQL 段（线上库 Supabase；与 MySQL 段等价，不可混用）
-- =============================================================
ALTER TABLE app_user
    ADD COLUMN IF NOT EXISTS role   VARCHAR(16) NOT NULL DEFAULT 'user',
    ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'active';

UPDATE app_user SET role = 'admin' WHERE username = 'admin';

COMMENT ON COLUMN app_user.role   IS '角色: admin/user';
COMMENT ON COLUMN app_user.status IS '状态: active/disabled';
