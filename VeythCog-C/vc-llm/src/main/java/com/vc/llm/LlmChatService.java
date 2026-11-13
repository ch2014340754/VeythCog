package com.vc.llm;

import com.vc.llm.router.LlmModelRouter;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;

/**
 * 大模型对话服务（多模型调度网关）。
 * <p>统一入口，按 vendor + modelCode 路由到对应模型；同步返回。
 * Phase 1 演进：SSE 流式、降级重试、token 用量统计。</p>
 */
@Service
public class LlmChatService {

    private final LlmModelRouter router;

    public LlmChatService(LlmModelRouter router) {
        this.router = router;
    }

    /**
     * 单次对话（同步）。
     *
     * @param userId         当前用户 id
     * @param vendor         厂商标识
     * @param modelCode      模型编码
     * @param conversationId 会话 id（用于会话隔离的记忆主键）
     * @param message        用户消息
     * @return 模型回复文本
     */
    public String chat(Long userId, String vendor, String modelCode, String conversationId, String message) {
        return router.chat(userId, vendor, modelCode, conversationId, message);
    }

    /** 对话（流式）：返回逐 token 增量，用于 SSE 逐字下发降低首响应时延 */
    public Flux<String> stream(Long userId, String vendor, String modelCode, String conversationId, String message) {
        return router.stream(userId, vendor, modelCode, conversationId, message);
    }

    /** 无记忆流式：搜索 AI 等一次性问答使用 */
    public Flux<String> streamStateless(Long userId, String vendor, String modelCode, String message) {
        return router.streamStateless(userId, vendor, modelCode, message);
    }

    /** 无记忆同步：上下文压缩摘要等内部场景使用 */
    public String chatStateless(Long userId, String vendor, String modelCode, String message) {
        return router.chatStateless(userId, vendor, modelCode, message);
    }
}
