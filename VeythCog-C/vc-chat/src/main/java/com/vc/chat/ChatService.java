package com.vc.chat;

import com.vc.llm.LlmChatService;
import org.springframework.stereotype.Service;

/**
 * 对话域服务：会话 / 消息 / 记忆管理的领域入口。
 * <p>当前委托 vc-llm 调度网关完成单次同步对话，保持与厂商解耦；
 * Phase 1 演进：会话 / 消息持久化、上下文组装与截断、SSE 流式。</p>
 */
@Service
public class ChatService {

    private final LlmChatService llmChatService;

    public ChatService(LlmChatService llmChatService) {
        this.llmChatService = llmChatService;
    }

    /** 单次对话（同步） */
    public String chat(Long userId, String vendor, String modelCode, String message) {
        return llmChatService.chat(userId, vendor, modelCode, message);
    }
}
