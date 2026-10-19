package com.vc.learn.examples.chat.service;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.ai.converter.ListOutputConverter;
import org.springframework.beans.factory.annotation.Autowired;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.core.convert.support.DefaultConversionService;

import com.vc.learn.examples.chat.ChatDemo;
import com.vc.learn.examples.chat.memory.FIleBasedChatMemory;
import com.vc.learn.examples.chat.service.ChatService.ActorsFilms;

/**
 * 测试结构化输出
 */

@SpringBootTest
public class StructuredOutTest {


    @Autowired
    private ChatDemo chatDemo;

    @Test
    void testStructuredOutcCall2() {
        // 泛型集合
        List<ActorsFilms> list = chatDemo.chatClient.prompt()
                .user("举例1部科幻电影和它的主演,输出给中文的")
                .call()
                .entity(new ParameterizedTypeReference<List<ActorsFilms>>() {
                });
        System.out.println(list);

    }

    // Map
    @Test
    void testMapOutcCall() {
        Map<String, Object> m = chatDemo.chatClient.prompt()
                .user(u -> u.text("Provide a List of {subject}")
                        .param("subject", "an array of numbers from 1 to 9 under the key 'numbers'"))
                .call()
                .entity(new ParameterizedTypeReference<Map<String, Object>>() {
                });
        System.out.println(m);
    }

    // List（配合 ListOutputConverter）
    @Test
    void testListOutcCall() {
        List<String> flavors = chatDemo.chatClient.prompt()
            .user(u -> u.text("List five {subject}").param("subject", "ice cream flavors"))
            .call()
            .entity(new ListOutputConverter(new DefaultConversionService()));
        System.out.println(flavors);
    }

}
