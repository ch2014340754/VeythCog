package com.vc.chat.memory;

import com.vc.chat.dto.ChatMessageInsert;
import com.vc.chat.dto.ChatMessageRow;
import com.vc.chat.mapper.ChatMessageMapper;
import org.springframework.ai.chat.memory.ChatMemoryRepository;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.MessageType;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

/**
 * 对话记忆仓库：把 Spring AI 的 {@link ChatMemoryRepository} 落到 {@code chat_message} 表。
 * <p>数据访问统一走 {@link ChatMessageMapper}（SQL 见 {@code resources/mapper/ChatMessageMapper.xml}）。</p>
 * <p>会话隔离由外层将记忆主键定为 {@code userId:conversationId} 保证，跨用户、跨会话互不串扰。</p>
 */
@Repository
public class MyBatisChatMessageRepository implements ChatMemoryRepository {

    private final ChatMessageMapper chatMessageMapper;

    public MyBatisChatMessageRepository(ChatMessageMapper chatMessageMapper) {
        this.chatMessageMapper = chatMessageMapper;
    }

    @Override
    public List<String> findConversationIds() {
        return chatMessageMapper.selectConversationIds();
    }

    @Override
    public List<Message> findByConversationId(String conversationId) {
        List<Message> messages = new ArrayList<>();
        for (ChatMessageRow row : chatMessageMapper.selectMessages(conversationId)) {
            MessageType type = MessageType.fromValue(row.getRole());
            Message message = switch (type) {
                case ASSISTANT -> new AssistantMessage(row.getContent());
                case SYSTEM -> new SystemMessage(row.getContent());
                default -> new UserMessage(row.getContent());
            };
            messages.add(message);
        }
        return messages;
    }

    /**
     * 全量覆盖该会话的记忆：先清空再按序写入（MessageWindowChatMemory 每次都会传入合并后的完整列表）。
     */
    @Override
    @Transactional
    public void saveAll(String conversationId, List<Message> messages) {
        chatMessageMapper.deleteByConversationId(conversationId);
        if (messages == null || messages.isEmpty()) {
            return;
        }
        List<ChatMessageInsert> rows = messages.stream()
                .map(m -> new ChatMessageInsert(m.getMessageType().getValue(), m.getText()))
                .toList();
        chatMessageMapper.insertBatch(conversationId, rows);
    }

    @Override
    public void deleteByConversationId(String conversationId) {
        chatMessageMapper.deleteByConversationId(conversationId);
    }
}
