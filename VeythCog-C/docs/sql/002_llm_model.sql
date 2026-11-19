
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
