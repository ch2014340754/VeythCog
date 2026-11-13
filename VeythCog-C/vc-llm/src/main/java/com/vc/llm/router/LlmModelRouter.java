package com.vc.llm.router;

import com.vc.common.exception.BusinessException;
import com.vc.common.exception.ErrorCode;
import com.vc.llm.config.LlmVendorProps;
import com.vc.llm.crypto.ApiKeyCryptoService;
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
import org.springframework.util.StringUtils;
import reactor.core.publisher.Flux;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 模型路由：校验用户绑定 → 查模型配置 → 解析密钥 → 缓存 ChatClient 实例 → 调用模型。
 *
 * <p>密钥解析顺序：<b>当前用户该供应商的自持 AK</b>（AES 解密）→ 配置文件 AK（兜底）。
 * 实例缓存键携带「用户 + Key 指纹」，因此换 Key 后旧实例不会被误用，也无需重启。</p>
 */
@Service
public class LlmModelRouter {

    private final UserLlmBindingRepository bindingRepository;
    private final LlmModelRepository modelRepository;
    private final List<LlmVendorFactory> factories;
    private final LlmVendorProps vendorProps;
    private final ApiKeyCryptoService apiKeyCryptoService;
    private final ChatMemory chatMemory;
    private final Map<String, ChatClient> cache = new ConcurrentHashMap<>();
    /** 无记忆 ChatClient：搜索 AI 等一次性问答使用，避免写入对话记忆 */
    private final Map<String, ChatClient> statelessCache = new ConcurrentHashMap<>();

    public LlmModelRouter(UserLlmBindingRepository bindingRepository,
                          LlmModelRepository modelRepository,
                          List<LlmVendorFactory> factories,
                          LlmVendorProps vendorProps,
                          ApiKeyCryptoService apiKeyCryptoService,
                          ChatMemory chatMemory) {
        this.bindingRepository = bindingRepository;
        this.modelRepository = modelRepository;
        this.factories = factories;
        this.vendorProps = vendorProps;
        this.apiKeyCryptoService = apiKeyCryptoService;
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

    /**
     * 无记忆流式调用：搜索 AI 等一次性问答使用。
     * <p>不挂 {@link MessageChatMemoryAdvisor}，因此不会读写任何 conversationId 的历史。</p>
     */
    public Flux<String> streamStateless(Long userId, String vendor, String modelCode, String message) {
        ChatClient chatClient = resolveStatelessChatClient(userId, vendor, modelCode);
        return chatClient.prompt()
                .user(message)
                .stream()
                .content()
                .onErrorMap(e -> wrap(e));
    }

    /** 校验绑定/模型/密钥，并返回（缓存）对应的 ChatClient */
    private ChatClient resolveChatClient(Long userId, String vendor, String modelCode) {
        Resolved resolved = resolve(userId, vendor, modelCode);
        String cacheKey = cacheKey(userId, vendor, modelCode, resolved.apiKey());
        return cache.computeIfAbsent(cacheKey, k -> {
            ChatModel rawModel = createModel(resolved, vendor);
            return ChatClient.builder(rawModel)
                    .defaultAdvisors(MessageChatMemoryAdvisor.builder(chatMemory).build())
                    .build();
        });
    }

    /** 无记忆客户端：与对话客户端使用同一套绑定/模型校验，但不挂记忆顾问。 */
    private ChatClient resolveStatelessChatClient(Long userId, String vendor, String modelCode) {
        Resolved resolved = resolve(userId, vendor, modelCode);
        String cacheKey = "stateless:" + cacheKey(userId, vendor, modelCode, resolved.apiKey());
        return statelessCache.computeIfAbsent(cacheKey, k -> {
            ChatModel rawModel = createModel(resolved, vendor);
            return ChatClient.builder(rawModel).build();
        });
    }

    /**
     * 绑定 + 模型 + 密钥解析。
     * <p>用户自持 AK 优先；解密失败直接 50000，不调用上游；无用户 AK 时回落配置文件；都没有则 50000。</p>
     */
    private Resolved resolve(Long userId, String vendor, String modelCode) {
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

        String apiKey = null;
        if (StringUtils.hasText(binding.getApiKeyCipher())) {
            apiKey = apiKeyCryptoService.decrypt(binding.getApiKeyCipher());
        }
        if (!StringUtils.hasText(apiKey)) {
            apiKey = vendorProps.apiKey(vendor);
        }
        if (!StringUtils.hasText(apiKey)) {
            throw new BusinessException(ErrorCode.SYSTEM_ERROR, "该模型未配置密钥");
        }
        return new Resolved(model, apiKey.trim());
    }

    private ChatModel createModel(Resolved resolved, String vendor) {
        LlmVendorFactory factory = factories.stream()
                .filter(f -> f.supports(vendor))
                .findFirst()
                .orElseThrow(() -> new BusinessException(ErrorCode.SYSTEM_ERROR, "不支持的厂商"));
        return factory.create(resolved.model(), resolved.apiKey(), vendorProps.baseUrl(vendor));
    }

    /** 缓存键含用户与 Key 指纹：同用户换 Key / 不同用户不同 Key 都不会串实例 */
    private String cacheKey(Long userId, String vendor, String modelCode, String apiKey) {
        return userId + ":" + vendor + ":" + modelCode + ":" + apiKeyCryptoService.fingerprint(apiKey);
    }

    /** 会话隔离：记忆主键 = userId + 会话 id，跨用户、跨会话互不串扰 */
    private static String memoryKey(Long userId, String conversationId) {
        return userId + ":" + (conversationId == null || conversationId.isBlank() ? "default" : conversationId);
    }

    private static BusinessException wrap(Throwable e) {
        String detail = e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
        return new BusinessException(ErrorCode.SYSTEM_ERROR, "模型调用失败：" + detail);
    }

    private record Resolved(LlmModel model, String apiKey) {
    }
}
