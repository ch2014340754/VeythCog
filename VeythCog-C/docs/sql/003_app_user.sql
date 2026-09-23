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
