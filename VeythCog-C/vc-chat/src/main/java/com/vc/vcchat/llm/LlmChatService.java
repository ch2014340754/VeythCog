package com.vc.vcchat.llm;

import com.vc.vcchat.llm.router.LlmModelRouter;
import org.springframework.stereotype.Service;

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
     * @param userId    当前用户 id
     * @param vendor    厂商标识
     * @param modelCode 模型编码
     * @param message   用户消息
     * @return 模型回复文本
     */
    public String chat(Long userId, String vendor, String modelCode, String message) {
        return router.chat(userId, vendor, modelCode, message);
    }
}
