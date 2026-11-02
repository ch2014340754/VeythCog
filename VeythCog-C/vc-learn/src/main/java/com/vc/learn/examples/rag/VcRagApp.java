package com.vc.learn.examples.rag;

import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.client.advisor.MessageChatMemoryAdvisor;
import org.springframework.ai.chat.client.advisor.QuestionAnswerAdvisor;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.memory.InMemoryChatMemoryRepository;
import org.springframework.ai.chat.memory.MessageWindowChatMemory;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.vectorstore.VectorStore;

import com.vc.learn.examples.chat.advisor.SimpleLoggerAdvisor;

import jakarta.annotation.Resource;

import lombok.extern.slf4j.Slf4j;

import org.springframework.stereotype.Service;

@Slf4j
@Service
public class VcRagApp {

    private static final String CHAT_MEMORY_CONVERSATION_ID_KEY = "chatId";
    private static final String CHAT_MEMORY_RETRIEVE_SIZE_KEY = "retrieveSize";

    @Resource
    private VectorStore vcVectorStore;


    public final ChatClient chatClient;

    public VcRagApp(ChatClient.Builder builder) {

        ChatMemory chatMemory = MessageWindowChatMemory.builder()
                .chatMemoryRepository(new InMemoryChatMemoryRepository())
                .maxMessages(10)
                .build();

        chatClient = builder.defaultAdvisors(MessageChatMemoryAdvisor.builder(chatMemory).build()).build();
    }

    public String doChatWithRag(String message, String chatId) {
        ChatResponse chatResponse = chatClient
                .prompt()
                .system("你是一个专业的问答机器人,仅基于知识库提供的文档内容回答问题，没有就回答“不知道”")
                .user(message)
                .advisors(spec -> spec.param(CHAT_MEMORY_CONVERSATION_ID_KEY, chatId)
                        .param(CHAT_MEMORY_RETRIEVE_SIZE_KEY, 10))
                // 开启日志，便于观察效果
                .advisors(new SimpleLoggerAdvisor())
                // 应用知识库问答
                .advisors(new QuestionAnswerAdvisor(vcVectorStore))
                .call()
                .chatResponse();
        String content = chatResponse.getResult().getOutput().getText();
        log.info("content: {}", content);
        return content;
    }

}
