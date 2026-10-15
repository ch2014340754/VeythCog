package com.vc.learn.examples.chat.service;

import java.util.List;

import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Service;
import org.springframework.web.bind.annotation.RequestParam;

import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import com.vc.learn.examples.chat.ChatDemo;
import com.vc.learn.examples.chat.advisor.SimpleLoggerAdvisor;

@Service
public class ChatService {

    @Autowired
    private ChatDemo chatDemo;

    String conversationId = "007";

    @JsonPropertyOrder({"actor", "movies"})
    record ActorsFilms(String actor, List<String> movies) {}

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
}
