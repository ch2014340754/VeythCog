-- =============================================================
-- 015_user_llm_binding_api_key.sql · 用户自持加密 API Key
-- 环境：PostgreSQL（vc 库）
-- 设计要点：
--   · 只新增可空列，存量绑定保持 NULL（自动走配置文件 AK 兜底），向后兼容
--   · api_key_cipher 存 AES-256-GCM 密文，格式 base64(iv):base64(ciphertext)
--   · AK 语义为「用户 + 供应商」级：同一 vendor 下所有绑定行共享同一份密文
--   · 幂等：IF NOT EXISTS，可重复执行
-- =============================================================
ALTER TABLE user_llm_binding
    ADD COLUMN IF NOT EXISTS api_key_cipher TEXT,
    ADD COLUMN IF NOT EXISTS api_key_updated_at TIMESTAMP;

COMMENT ON COLUMN user_llm_binding.api_key_cipher IS '用户自持 API Key 的 AES-256-GCM 密文（base64(iv):base64(ct)），NULL 表示使用系统配置兜底';
COMMENT ON COLUMN user_llm_binding.api_key_updated_at IS '最近一次写入用户 API Key 的时间';
