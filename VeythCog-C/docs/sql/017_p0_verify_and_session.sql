-- 017: P0 收口 —— 模型连通校验状态 + 会话级配置表
-- 执行要求：幂等，可重复执行。

-- 1. 绑定表：连通校验结果（PRD v1.1 §2.2 的 is_valid / last_verify_at，另加错误原因便于前端提示）
ALTER TABLE user_llm_binding ADD COLUMN IF NOT EXISTS is_valid BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE user_llm_binding ADD COLUMN IF NOT EXISTS last_verify_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE user_llm_binding ADD COLUMN IF NOT EXISTS verify_error VARCHAR(300);

COMMENT ON COLUMN user_llm_binding.is_valid IS '是否通过连通校验；只有 true 的绑定可出现在对话模型下拉';
COMMENT ON COLUMN user_llm_binding.last_verify_at IS '最近一次连通校验时间';
COMMENT ON COLUMN user_llm_binding.verify_error IS '最近一次校验失败原因（成功为 NULL）';

-- 2. 会话表：会话级模型 / 知识库文档 / 上下文压缩开关
CREATE TABLE IF NOT EXISTS chat_session (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    conversation_id VARCHAR(64) NOT NULL,
    session_title VARCHAR(255),
    vendor_code VARCHAR(32),
    model_code VARCHAR(64),
    -- 逗号分隔的文档 id，如 "12,34"；空串表示不启用 RAG
    rag_doc_ids TEXT NOT NULL DEFAULT '',
    enable_context_compress BOOLEAN NOT NULL DEFAULT true,
    deleted BOOLEAN NOT NULL DEFAULT false,
    create_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    update_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_chat_session_user_conv
    ON chat_session (user_id, conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_session_user
    ON chat_session (user_id, deleted);

COMMENT ON TABLE chat_session IS '会话级配置：模型绑定 / RAG 文档集合 / 上下文自动压缩开关';
COMMENT ON COLUMN chat_session.conversation_id IS '与 chat_message.conversation_id 对应的前端会话 id';
COMMENT ON COLUMN chat_session.rag_doc_ids IS '逗号分隔的知识库文档 id';
