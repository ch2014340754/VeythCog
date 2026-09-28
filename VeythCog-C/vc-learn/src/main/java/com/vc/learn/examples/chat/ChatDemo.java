package com.vc.learn.examples.chat;

import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

/**
 * 最小示例：注入 DashScope ChatModel，发起一次真实对话，验证「连接百炼」。
 * <p>非 Web 应用，run 完成后进程自动退出。后续学习点按主题分包新增：
 * <ul>
 *   <li>chat/    基础对话、流式（stream）</li>
 *   <li>function/ Function Calling</li>
 *   <li>embedding/ Embedding（为 RAG 铺路）</li>
 *   <li>agent/    多 Agent / 编排</li>
 * </ul></p>
 */
@Component
public class ChatDemo implements CommandLineRunner {

    private final ChatModel chatModel;

    public ChatDemo(ChatModel chatModel) {
        this.chatModel = chatModel;
    }

    @Override
    public void run(String... args) {
        String reply = chatModel
                .call(new Prompt("你好，请用一句话介绍你自己。"))
                .getResult()
                .getOutput()
                .getText();
        System.out.println("[vc-learn] 百炼回复：" + reply);
    }
}
