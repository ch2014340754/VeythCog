package com.vc.chat.memory;

import org.springframework.ai.chat.memory.ChatMemoryRepository;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.MessageType;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * JDBC 对话记忆仓库：把 Spring AI 的 {@link ChatMemoryRepository} 落到关系库 {@code chat_message} 表。
 * <p>以 {@code (conversation_id, seq)} 顺序存取消息；会话隔离由外层将记忆主键定为
 * {@code userId:conversationId} 保证，跨用户、跨会话互不串扰。</p>
 * <p>建表脚本见 {@code docs/sql/006_chat_message.sql}（PostgreSQL 方言，MySQL 差异见脚本注释）。</p>
 */
@Repository
public class JdbcChatMessageRepository implements ChatMemoryRepository {

    private final JdbcTemplate jdbcTemplate;

    public JdbcChatMessageRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public List<String> findConversationIds() {
        return jdbcTemplate.queryForList(
                "SELECT DISTINCT conversation_id FROM chat_message ORDER BY conversation_id",
                String.class);
    }

    @Override
    public List<Message> findByConversationId(String conversationId) {
        return jdbcTemplate.query(
                "SELECT role, content FROM chat_message WHERE conversation_id = ? ORDER BY seq",
                MESSAGE_ROW_MAPPER, conversationId);
    }

    /**
     * 全量覆盖该会话的记忆：先清空再按序写入（MessageWindowChatMemory 每次都会传入合并后的完整列表）。
     */
    @Override
    @Transactional
    public void saveAll(String conversationId, List<Message> messages) {
        jdbcTemplate.update("DELETE FROM chat_message WHERE conversation_id = ?", conversationId);
        if (messages == null || messages.isEmpty()) {
            return;
        }
        AtomicInteger seq = new AtomicInteger();
        jdbcTemplate.batchUpdate(
                "INSERT INTO chat_message (conversation_id, seq, role, content) VALUES (?, ?, ?, ?)",
                messages,
                messages.size(),
                (ps, message) -> {
                    ps.setString(1, conversationId);
                    ps.setInt(2, seq.getAndIncrement());
                    ps.setString(3, message.getMessageType().getValue());
                    ps.setString(4, message.getText());
                });
    }

    @Override
    public void deleteByConversationId(String conversationId) {
        jdbcTemplate.update("DELETE FROM chat_message WHERE conversation_id = ?", conversationId);
    }

    private static final RowMapper<Message> MESSAGE_ROW_MAPPER = (rs, rowNum) -> {
        MessageType type = MessageType.fromValue(rs.getString("role"));
        String content = rs.getString("content");
        return switch (type) {
            case ASSISTANT -> new AssistantMessage(content);
            case SYSTEM -> new SystemMessage(content);
            default -> new UserMessage(content);
        };
    };
}
