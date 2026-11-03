-- =============================================================
-- 004_user_llm_binding.sql · 用户-模型绑定中间表
-- 环境：PostgreSQL（vc 库）
-- 设计要点：
--   · id 用 BIGSERIAL 主键，适配 JPA IDENTITY 策略
--   · create_time 用 TIMESTAMP；is_default / enabled 用 BOOLEAN
--   · 列/表注释用独立的 COMMENT ON 语句
--   · 唯一约束、外键用表内 CONSTRAINT
--   · 普通索引用独立 CREATE INDEX
--   · 用 PG 部分唯一索引保证「每用户至多 1 个默认模型」
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
