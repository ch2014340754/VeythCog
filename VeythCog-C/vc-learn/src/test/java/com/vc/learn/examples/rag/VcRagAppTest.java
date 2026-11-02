package com.vc.learn.examples.rag;

import java.util.UUID;

import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
public class VcRagAppTest {

    @Autowired
    private VcRagApp vcRagApp;

    @Test
    void testDoChatWithRag() {
        String chatId = UUID.randomUUID().toString();
        String message = "光的热转换公式是什么？";
        String answer = vcRagApp.doChatWithRag(message, chatId);
        Assertions.assertNotNull(answer);

    }
}
