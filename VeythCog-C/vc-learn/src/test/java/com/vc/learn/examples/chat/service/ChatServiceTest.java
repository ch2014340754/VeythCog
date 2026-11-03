package com.vc.learn.examples.chat.service;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
public class ChatServiceTest {

    @Autowired
    private ChatService chatService;

    @Test
    void testFileBasedChatModel() {
        String content = chatService.fileBasedChatModel("004", "我一共有哪些症状？");
        System.out.println(content);
    }
}
