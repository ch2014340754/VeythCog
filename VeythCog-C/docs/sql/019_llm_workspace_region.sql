-- 019: 用户级 DashScope 地域 / 业务空间
-- 语义与 API Key 一致：同一 user + vendor 下所有绑定行共享；为空时回落服务端配置。
ALTER TABLE user_llm_binding ADD COLUMN IF NOT EXISTS workspace_id VARCHAR(64);
ALTER TABLE user_llm_binding ADD COLUMN IF NOT EXISTS region VARCHAR(32);

COMMENT ON COLUMN user_llm_binding.workspace_id IS '百炼业务空间 ID（如 llm-xxxx），为空回落 llm.vendors.dashscope.workspace-id';
COMMENT ON COLUMN user_llm_binding.region IS '百炼地域代码（如 cn-beijing），为空回落配置或默认 cn-beijing';

CREATE INDEX IF NOT EXISTS idx_user_llm_binding_workspace
    ON user_llm_binding (user_id, vendor_code, workspace_id);
