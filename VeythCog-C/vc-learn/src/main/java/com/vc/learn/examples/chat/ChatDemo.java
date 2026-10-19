package com.vc.learn.examples.chat;

import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.client.advisor.MessageChatMemoryAdvisor;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.memory.InMemoryChatMemoryRepository;
import org.springframework.ai.chat.memory.MessageWindowChatMemory;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.stereotype.Component;

import com.vc.learn.config.SystemPromptService;

@Component
public class ChatDemo {

    public final ChatClient chatClient;

    public ChatDemo(ChatClient.Builder builder, SystemPromptService systemPromptService) {

        ChatMemory chatMemory = MessageWindowChatMemory.builder()
                .chatMemoryRepository(new InMemoryChatMemoryRepository())
                .maxMessages(10)
                .build();

        ChatClient.Builder chatClientBuilder = builder
                .defaultAdvisors(MessageChatMemoryAdvisor.builder(chatMemory).build());

        // 注入系统提示词（如中医角色），模板由配置驱动
        SystemMessage systemMessage = systemPromptService.buildSystemMessage();
        if (systemMessage != null) {
            chatClientBuilder.defaultSystem(systemMessage.getText());
        }

        chatClient = chatClientBuilder.build();
    }

}
