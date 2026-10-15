package com.vc.learn.examples.chat.controller;

import java.util.List;

import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import com.vc.learn.examples.chat.ChatDemo;
import com.vc.learn.examples.chat.advisor.RereadingAdvisor;
import com.vc.learn.examples.chat.advisor.SimpleLoggerAdvisor;

@RestController
@RequestMapping("/chat")
public class ChatController {

    @Autowired
    private ChatDemo chatDemo;

    String conversationId = "007";

    @JsonPropertyOrder({"actor", "movies"})
    record ActorsFilms(String actor, List<String> movies) {}

    /**
     * 普通输出
     * @param question
     * @return
     */
    @GetMapping("/call/{question}")
    public String call(@PathVariable("question") String question) {
        return chatDemo.chatClient.prompt().user(question)
                .advisors(
                    // new RereadingAdvisor(),
                    new SimpleLoggerAdvisor()
                )
                .advisors(a -> a.param(ChatMemory.CONVERSATION_ID, conversationId))
                .call()
                .content();
    }

    /**
     * 结构化输出
     * @param question
     * @return
     */
    @GetMapping("/call")
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