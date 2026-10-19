package com.vc.learn.examples.chat.service;

import java.util.List;

import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.client.advisor.MessageChatMemoryAdvisor;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Service;
import org.springframework.web.bind.annotation.RequestParam;

import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import com.vc.learn.config.SystemPromptService;
import com.vc.learn.examples.chat.ChatDemo;
import com.vc.learn.examples.chat.advisor.SimpleLoggerAdvisor;
import com.vc.learn.examples.chat.memory.FIleBasedChatMemory;

@Service
public class ChatService {

    @Autowired
    private ChatDemo chatDemo;

    @Autowired
    private ChatModel dashboardChatModel;

    @Autowired
    private SystemPromptService systemPromptService;

    String conversationId = "007";

    @JsonPropertyOrder({ "actor", "movies" })
    record ActorsFilms(String actor, List<String> movies) {
    }

    public List<ActorsFilms> structuredOutcCall(@RequestParam("question") String question) {
        return chatDemo.chatClient.prompt().user(question)
                .advisors(
                        // new RereadingAdvisor(),
                        new SimpleLoggerAdvisor())
                .advisors(a -> a.param(ChatMemory.CONVERSATION_ID, conversationId))
                .call()
                .entity(new ParameterizedTypeReference<List<ActorsFilms>>() {
                });
    }

    // 基于文件的 ChatMemory 实现
    public String fileBasedChatModel(String conversationId, String question) {
        if (conversationId == null) {
            throw new IllegalArgumentException("conversationId is required");
        }
        SystemMessage systemMessage = systemPromptService.buildSystemMessage();
        if (systemMessage == null) {
            throw new IllegalArgumentException("systemMessage is required");
        }
        ChatClient chatClient = ChatClient.builder(dashboardChatModel).defaultAdvisors(
                MessageChatMemoryAdvisor.builder(new FIleBasedChatMemory()).build(),
                new SimpleLoggerAdvisor()).defaultSystem(systemMessage.getText()).build();
        // AI 返回的是自然语言文本，不能用 .entity(Class) 做 JSON 反序列化，否则 Jackson 解析失败
        return chatClient.prompt().user(question)
                .advisors(a -> a.param(ChatMemory.CONVERSATION_ID, conversationId))
                .call()
                .content();
    }

}
