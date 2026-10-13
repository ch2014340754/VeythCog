package com.vc.learn.examples.chat.controller;

import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.vc.learn.examples.chat.ChatDemo;
import com.vc.learn.examples.chat.advisor.RereadingAdvisor;
import com.vc.learn.examples.chat.advisor.SimpleLoggerAdvisor;

@RestController
@RequestMapping("/chat")
public class ChatController {

    @Autowired
    private ChatDemo chatDemo;

    String conversationId = "007";

    @GetMapping("/call/{question}")
    public String call(@PathVariable("question") String question) {
        return chatDemo.chatClient.prompt().user(question)
                .advisors(new SimpleLoggerAdvisor(), new RereadingAdvisor())
                .advisors(a -> a.param(ChatMemory.CONVERSATION_ID, conversationId))
                .call()
                .content();
    }
}