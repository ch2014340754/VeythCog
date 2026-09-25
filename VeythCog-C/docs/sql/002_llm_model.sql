-- =============================================================
-- 001_llm_model.sql · 模型目录表（vendor_code 仅存字符串，供应商为后端枚举不建表）
-- 环境：MySQL 5.7 (vc 库)
-- 迁 PostgreSQL 注意：
--   · BIGINT AUTO_INCREMENT → BIGSERIAL / BIGINT GENERATED ALWAYS AS IDENTITY
--   · 去掉 ENGINE=InnoDB / COMMENT
--   · DATETIME → TIMESTAMP；DECIMAL(3,2) 保留
--   · 供应商不再建表：vendor_code 只是字符串列，删除 vendor 外键
-- =============================================================
CREATE TABLE IF NOT EXISTS llm_model (
    id                 BIGINT        NOT NULL AUTO_INCREMENT,
    vendor_code        VARCHAR(32)   NOT NULL COMMENT '所属供应商（枚举 code：deepseek / dashscope）',
    model_code         VARCHAR(64)   NOT NULL COMMENT '模型编码，如 deepseek-chat / qwen-plus',
    model_name         VARCHAR(64)   NOT NULL COMMENT '展示名',
    max_context_tokens INT           NOT NULL DEFAULT 32768 COMMENT '最大上下文窗口（记忆截断预留）',
    temperature        DECIMAL(3, 2) NOT NULL DEFAULT 0.70 COMMENT '默认温度',
    enabled            TINYINT(1)    NOT NULL DEFAULT 1 COMMENT '是否启用',
    create_time        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_vendor_model (vendor_code, model_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='模型目录';


-- =============================================================
-- ↓↓↓ PostgreSQL 版本（与上方 MySQL DDL 等价） ↓↓↓
-- 转换要点：
--   · BIGINT AUTO_INCREMENT → BIGSERIAL（适配 JPA IDENTITY 策略）
--   · DATETIME → TIMESTAMP；TINYINT(1) → BOOLEAN（实体字段为 Boolean）
--   · 列/表注释改为独立的 COMMENT ON 语句
--   · 去掉 ENGINE / CHARSET；UNIQUE KEY 改为表内 CONSTRAINT
-- =============================================================
CREATE TABLE IF NOT EXISTS llm_model (
    id                 BIGSERIAL     PRIMARY KEY,
    vendor_code        VARCHAR(32)   NOT NULL,
    model_code         VARCHAR(64)   NOT NULL,
    model_name         VARCHAR(64)   NOT NULL,
    max_context_tokens INTEGER       NOT NULL DEFAULT 32768,
    temperature        DECIMAL(3, 2) NOT NULL DEFAULT 0.70,
    enabled            BOOLEAN       NOT NULL DEFAULT TRUE,
    create_time        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_vendor_model UNIQUE (vendor_code, model_code)
);

COMMENT ON TABLE  llm_model IS '模型目录';
COMMENT ON COLUMN llm_model.vendor_code IS '所属供应商（枚举 code：deepseek / dashscope）';
COMMENT ON COLUMN llm_model.model_code IS '模型编码，如 deepseek-chat / qwen-plus';
COMMENT ON COLUMN llm_model.model_name IS '展示名';
COMMENT ON COLUMN llm_model.max_context_tokens IS '最大上下文窗口（记忆截断预留）';
COMMENT ON COLUMN llm_model.temperature IS '默认温度';
COMMENT ON COLUMN llm_model.enabled IS '是否启用';
