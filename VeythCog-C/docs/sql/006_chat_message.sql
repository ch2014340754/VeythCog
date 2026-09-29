-- =============================================================================
-- 006_chat_message.sql  ·  对话记忆表（Spring AI JDBC ChatMemory 落库）
-- -----------------------------------------------------------------------------
-- 用途：MessageChatMemoryAdvisor 通过 JdbcChatMessageRepository 读写本表，
--       以 (conversation_id, seq) 顺序保存每轮 user/assistant 消息。
-- 会话隔离：conversation_id 存储的是后端拼接的 "userId:conversationId"，
--          跨用户、跨会话天然隔离。
-- 环境：当前 active 库为 PostgreSQL（supabase），按 PG 方言书写；
--      MySQL 差异已在每处用注释标注。
-- 注意：需对目标库执行本脚本后，记忆功能才会生效（ddl-auto=none，不自动建表）。
-- =============================================================================

CREATE TABLE IF NOT EXISTS chat_message (
    id              BIGSERIAL PRIMARY KEY,      -- MySQL: BIGINT AUTO_INCREMENT PRIMARY KEY
    conversation_id VARCHAR(255)  NOT NULL,      -- 记忆主键（userId:conversationId）
    seq             INTEGER       NOT NULL,      -- 消息序号（同一会话内递增）
    role            VARCHAR(16)   NOT NULL,      -- user / assistant / system
    content         TEXT          NOT NULL,
    created_at      TIMESTAMPTZ   DEFAULT now() -- MySQL: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 会话内按序号唯一，供 ORDER BY seq 还原对话顺序
CREATE UNIQUE INDEX IF NOT EXISTS uk_chat_message_conv_seq
    ON chat_message (conversation_id, seq);      -- MySQL: CREATE UNIQUE INDEX uk_chat_message_conv_seq ON chat_message (conversation_id, seq)

-- 会话查询/删除走主键前缀
CREATE INDEX IF NOT EXISTS idx_chat_message_conv
    ON chat_message (conversation_id);           -- MySQL: CREATE INDEX idx_chat_message_conv ON chat_message (conversation_id)
