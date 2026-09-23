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
