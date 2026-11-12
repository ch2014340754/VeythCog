package com.vc.chat;

import com.vc.llm.LlmChatService;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;

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

    /** 单次对话（同步）：携带会话 id，供记忆顾问做会话隔离 */
    public String chat(Long userId, String vendor, String modelCode, String conversationId, String message) {
        return llmChatService.chat(userId, vendor, modelCode, conversationId, message);
    }

    /** 对话（流式）：返回逐 token 增量，用于 SSE 逐字下发降低首响应时延 */
    public Flux<String> streamChat(Long userId, String vendor, String modelCode, String conversationId, String message) {
        return llmChatService.stream(userId, vendor, modelCode, conversationId, message);
    }

    /** 无记忆流式：搜索 AI 等一次性问答使用，不读写对话历史 */
    public Flux<String> streamChatStateless(Long userId, String vendor, String modelCode, String message) {
        return llmChatService.streamStateless(userId, vendor, modelCode, message);
    }
}
