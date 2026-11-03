-- =============================================================
-- 003_app_user.sql · 用户表（避开 user 保留字）
-- 环境：PostgreSQL（vc 库）
-- 设计要点：
--   · id 用 BIGSERIAL 主键，适配 JPA IDENTITY 策略
--   · create_time 用 TIMESTAMP
--   · 列/表注释用独立的 COMMENT ON 语句
--   · 唯一约束用表内 CONSTRAINT
--   · password 存 BCrypt 密文，迁库时保持密文即可
-- =============================================================
CREATE TABLE IF NOT EXISTS app_user (
    id          BIGSERIAL     PRIMARY KEY,
    username    VARCHAR(64)   NOT NULL,
    password    VARCHAR(128)  NOT NULL,
    nickname    VARCHAR(64)   NOT NULL DEFAULT '',
    email       VARCHAR(128)  NOT NULL DEFAULT '',
    create_time TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_username UNIQUE (username)
);

COMMENT ON TABLE  app_user IS '用户表';
COMMENT ON COLUMN app_user.username IS '登录名';
COMMENT ON COLUMN app_user.password IS 'BCrypt 密文，绝不存明文';
COMMENT ON COLUMN app_user.nickname IS '显示名';
COMMENT ON COLUMN app_user.email IS '邮箱';
