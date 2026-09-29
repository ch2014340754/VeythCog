package com.vc.llm.router;

import com.vc.common.exception.BusinessException;
import com.vc.common.exception.ErrorCode;
import com.vc.llm.config.LlmVendorProps;
import com.vc.llm.entity.LlmModel;
import com.vc.llm.entity.UserLlmBinding;
import com.vc.llm.factory.LlmVendorFactory;
import com.vc.llm.repository.LlmModelRepository;
import com.vc.llm.repository.UserLlmBindingRepository;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.client.advisor.MessageChatMemoryAdvisor;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 模型路由：校验用户绑定 → 查模型配置 → 缓存 ChatClient 实例 → 携带记忆顾问调用模型。
 * <p>使用 Spring AI {@link ChatClient}（替代底层 {@link ChatModel#call}），
 * 并挂载 {@link MessageChatMemoryAdvisor} + JDBC 记忆，按会话隔离上下文。
 * 提供同步（{@link #chat}）与流式（{@link #stream}）两种调用。</p>
 */
@Service
public class LlmModelRouter {

    private final UserLlmBindingRepository bindingRepository;
    private final LlmModelRepository modelRepository;
    private final List<LlmVendorFactory> factories;
    private final LlmVendorProps vendorProps;
    private final ChatMemory chatMemory;
    private final Map<String, ChatClient> cache = new ConcurrentHashMap<>();

    public LlmModelRouter(UserLlmBindingRepository bindingRepository,
                          LlmModelRepository modelRepository,
                          List<LlmVendorFactory> factories,
                          LlmVendorProps vendorProps,
                          ChatMemory chatMemory) {
        this.bindingRepository = bindingRepository;
        this.modelRepository = modelRepository;
        this.factories = factories;
        this.vendorProps = vendorProps;
        this.chatMemory = chatMemory;
    }

    /** 对话（同步）。 */
    public String chat(Long userId, String vendor, String modelCode, String conversationId, String message) {
        ChatClient chatClient = resolveChatClient(userId, vendor, modelCode);
        String memoryKey = memoryKey(userId, conversationId);
        try {
            return chatClient.prompt()
                    .user(message)
                    .advisors(a -> a.param(ChatMemory.CONVERSATION_ID, memoryKey))
                    .call()
                    .content();
        } catch (RuntimeException e) {
            throw wrap(e);
        }
    }

    /**
     * 对话（流式）：返回逐 token 的回复增量，首 token 到达即推送，显著降低首响应时延。
     * 记忆顾问仍按会话 id 在 after 阶段落库，跨调用上下文连续。
     */
    public Flux<String> stream(Long userId, String vendor, String modelCode, String conversationId, String message) {
        ChatClient chatClient = resolveChatClient(userId, vendor, modelCode);
        String memoryKey = memoryKey(userId, conversationId);
        return chatClient.prompt()
                .user(message)
                .advisors(a -> a.param(ChatMemory.CONVERSATION_ID, memoryKey))
                .stream()
                .content()
                .onErrorMap(e -> wrap(e));
    }

    /** 校验绑定/模型/密钥，并返回（缓存）对应的 ChatClient */
    private ChatClient resolveChatClient(Long userId, String vendor, String modelCode) {
        UserLlmBinding binding = bindingRepository
                .findByUserIdAndVendorCodeAndModelCode(userId, vendor, modelCode)
                .orElseThrow(() -> new BusinessException(ErrorCode.PARAMS_ERROR, "模型不可用"));
        if (!Boolean.TRUE.equals(binding.getEnabled())) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "模型不可用");
        }
        LlmModel model = modelRepository.findByVendorCodeAndModelCode(vendor, modelCode)
                .orElseThrow(() -> new BusinessException(ErrorCode.PARAMS_ERROR, "模型不可用"));
        if (!Boolean.TRUE.equals(model.getEnabled())) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "模型不可用");
        }

        String apiKey = vendorProps.apiKey(vendor);
        if (apiKey == null || apiKey.isBlank()) {
            throw new BusinessException(ErrorCode.SYSTEM_ERROR, "该模型未配置密钥");
        }

        return cache.computeIfAbsent(vendor + ":" + modelCode, k -> {
            LlmVendorFactory factory = factories.stream()
                    .filter(f -> f.supports(vendor))
                    .findFirst()
                    .orElseThrow(() -> new BusinessException(ErrorCode.SYSTEM_ERROR, "不支持的厂商"));
            ChatModel rawModel = factory.create(model, apiKey, vendorProps.baseUrl(vendor));
            return ChatClient.builder(rawModel)
                    .defaultAdvisors(MessageChatMemoryAdvisor.builder(chatMemory).build())
                    .build();
        });
    }

    /** 会话隔离：记忆主键 = userId + 会话 id，跨用户、跨会话互不串扰 */
    private static String memoryKey(Long userId, String conversationId) {
        return userId + ":" + (conversationId == null || conversationId.isBlank() ? "default" : conversationId);
    }

    private static BusinessException wrap(Throwable e) {
        String detail = e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
        return new BusinessException(ErrorCode.SYSTEM_ERROR, "模型调用失败：" + detail);
    }
}
