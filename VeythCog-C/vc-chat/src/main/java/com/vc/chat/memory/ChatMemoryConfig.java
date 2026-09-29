package com.vc.chat.memory;

import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.memory.MessageWindowChatMemory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * 对话记忆装配：把 JDBC 记忆仓库包装成 Spring AI 的 {@link ChatMemory}，
 * 供 vc-llm 路由层的 {@code MessageChatMemoryAdvisor} 使用。
 * <p>记忆窗口按最近 N 条截断，控制每次上文的 token 成本。</p>
 */
@Configuration
public class ChatMemoryConfig {

    /** 单个会话记忆窗口长度（消息条数），超出按最近 N 条截断 */
    private static final int MEMORY_WINDOW_SIZE = 20;

    @Bean
    public ChatMemory chatMemory(JdbcChatMessageRepository repository) {
        return MessageWindowChatMemory.builder()
                .chatMemoryRepository(repository)
                .maxMessages(MEMORY_WINDOW_SIZE)
                .build();
    }
}
