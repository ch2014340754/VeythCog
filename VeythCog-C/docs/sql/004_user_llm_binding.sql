-- =============================================================
-- 004_user_llm_binding.sql · 用户-模型绑定中间表
-- 环境：MySQL 5.7 (vc 库)
-- 迁 PostgreSQL 注意：
--   · 去掉 ENGINE=InnoDB / COMMENT
--   · is_default 唯一性建议迁移时加部分唯一索引：
--       CREATE UNIQUE INDEX uq_user_default ON user_llm_binding (user_id)
--         WHERE is_default = 1;
-- =============================================================
CREATE TABLE IF NOT EXISTS user_llm_binding (
    id          BIGINT      NOT NULL AUTO_INCREMENT,
    user_id     BIGINT      NOT NULL COMMENT '用户 id',
    vendor_code VARCHAR(32) NOT NULL COMMENT '厂商标识',
    model_code  VARCHAR(64) NOT NULL COMMENT '模型编码',
    is_default  TINYINT(1)  NOT NULL DEFAULT 0 COMMENT '是否默认模型（每用户至多 1 个，应用层保证）',
    enabled     TINYINT(1)  NOT NULL DEFAULT 1 COMMENT '是否启用',
    create_time DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_user_vendor_model (user_id, vendor_code, model_code),
    KEY idx_user (user_id),
    CONSTRAINT fk_binding_user  FOREIGN KEY (user_id)     REFERENCES app_user (id),
    CONSTRAINT fk_binding_model FOREIGN KEY (vendor_code, model_code) REFERENCES llm_model (vendor_code, model_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户-模型绑定';


-- =============================================================
-- ↓↓↓ PostgreSQL 版本（与上方 MySQL DDL 等价） ↓↓↓
-- 转换要点：
--   · BIGINT AUTO_INCREMENT → BIGSERIAL（适配 JPA IDENTITY 策略）
--   · DATETIME → TIMESTAMP；TINYINT(1) → BOOLEAN（实体字段为 Boolean）
--   · 列/表注释改为独立的 COMMENT ON 语句
--   · 去掉 ENGINE / CHARSET；UNIQUE KEY 改为表内 CONSTRAINT
--   · MySQL 的 KEY idx_user → 独立 CREATE INDEX
--   · 外键语法 PG 与 MySQL 基本一致，直接保留在表内
--   · 用 PG 部分唯一索引保证「每用户至多 1 个默认模型」（MySQL 不支持）
-- 执行顺序：需先建好 app_user、llm_model（外键依赖）
-- =============================================================
CREATE TABLE IF NOT EXISTS user_llm_binding (
    id          BIGSERIAL    PRIMARY KEY,
    user_id     BIGINT       NOT NULL,
    vendor_code VARCHAR(32)  NOT NULL,
    model_code  VARCHAR(64)  NOT NULL,
    is_default  BOOLEAN      NOT NULL DEFAULT FALSE,
    enabled     BOOLEAN      NOT NULL DEFAULT TRUE,
    create_time TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_user_vendor_model UNIQUE (user_id, vendor_code, model_code),
    CONSTRAINT fk_binding_user  FOREIGN KEY (user_id)
        REFERENCES app_user (id),
    CONSTRAINT fk_binding_model FOREIGN KEY (vendor_code, model_code)
        REFERENCES llm_model (vendor_code, model_code)
);

CREATE INDEX IF NOT EXISTS idx_user ON user_llm_binding (user_id);

-- 部分唯一索引：仅对 is_default = TRUE 的行生效，保证每用户至多 1 个默认模型
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_default
    ON user_llm_binding (user_id)
    WHERE is_default = TRUE;

COMMENT ON TABLE  user_llm_binding IS '用户-模型绑定';
COMMENT ON COLUMN user_llm_binding.user_id IS '用户 id';
COMMENT ON COLUMN user_llm_binding.vendor_code IS '厂商标识';
COMMENT ON COLUMN user_llm_binding.model_code IS '模型编码';
COMMENT ON COLUMN user_llm_binding.is_default IS '是否默认模型（每用户至多 1 个，部分唯一索引保证）';
COMMENT ON COLUMN user_llm_binding.enabled IS '是否启用';
