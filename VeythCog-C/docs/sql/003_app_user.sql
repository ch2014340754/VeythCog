-- =============================================================
-- 003_app_user.sql · 用户表（避开 user 保留字）
-- 环境：MySQL 5.7 (vc 库)
-- 迁 PostgreSQL 注意：
--   · BIGINT AUTO_INCREMENT → BIGSERIAL
--   · 去掉 ENGINE=InnoDB / COMMENT
--   · password 存 BCrypt 密文，迁库时保持密文即可
-- =============================================================
CREATE TABLE IF NOT EXISTS app_user (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    username    VARCHAR(64)  NOT NULL COMMENT '登录名',
    password    VARCHAR(128) NOT NULL COMMENT 'BCrypt 密文，绝不存明文',
    nickname    VARCHAR(64)  NOT NULL DEFAULT '' COMMENT '显示名',
    email       VARCHAR(128) NOT NULL DEFAULT '' COMMENT '邮箱',
    create_time DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';


-- =============================================================
-- ↓↓↓ PostgreSQL 版本（与上方 MySQL DDL 等价） ↓↓↓
-- 转换要点：
--   · BIGINT AUTO_INCREMENT → BIGSERIAL（适配 JPA IDENTITY 策略）
--   · DATETIME → TIMESTAMP
--   · 列/表注释改为独立的 COMMENT ON 语句
--   · 去掉 ENGINE / CHARSET；UNIQUE KEY 改为表内 CONSTRAINT
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
