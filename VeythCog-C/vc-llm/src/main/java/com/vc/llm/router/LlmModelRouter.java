package com.vc.llm.router;

import com.vc.common.exception.BusinessException;
import com.vc.common.exception.ErrorCode;
import com.vc.llm.config.LlmVendorProps;
import com.vc.llm.crypto.ApiKeyCryptoService;
import com.vc.llm.entity.LlmModel;
import com.vc.llm.entity.UserLlmBinding;
import com.vc.llm.factory.LlmVendorFactory;
import com.vc.llm.service.LlmEndpointService;
import com.vc.llm.metrics.LlmCallRecorder;
import com.vc.llm.metrics.LlmCallRecord;
import com.vc.llm.metrics.TokenEstimator;
import com.vc.llm.repository.LlmModelRepository;
import com.vc.llm.repository.UserLlmBindingRepository;
import com.vc.llm.repository.UserLlmModelVerifyRepository;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.client.advisor.MessageChatMemoryAdvisor;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.metadata.Usage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import reactor.core.publisher.Flux;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

/**
 * 模型路由：校验用户绑定 → 查模型配置 → 解析密钥 → 缓存 ChatClient 实例 → 调用模型。
 *
 * <p>密钥解析顺序：<b>当前用户该供应商的自持 AK</b>（AES 解密）→ 配置文件 AK（兜底）。
 * 调用地址解析顺序：用户保存的地域 / 业务空间 → 配置文件 → 标准 dashscope 域名。
 * 实例缓存键携带「用户 + Key 指纹 + 地址指纹」，因此换 Key 或换业务空间后旧实例不会被误用，也无需重启。</p>
 */
@Service
public class LlmModelRouter {

    private final UserLlmBindingRepository bindingRepository;
    private final LlmModelRepository modelRepository;
    private final UserLlmModelVerifyRepository verifyRepository;
    private final List<LlmVendorFactory> factories;
    private final LlmVendorProps vendorProps;
    private final LlmEndpointService endpointService;
    private final ApiKeyCryptoService apiKeyCryptoService;
    private final ChatMemory chatMemory;
    private final ObjectProvider<LlmCallRecorder> recorderProvider;
    private final Map<String, ChatClient> cache = new ConcurrentHashMap<>();
    /** 无记忆 ChatClient：搜索 AI 等一次性问答使用，避免写入对话记忆 */
    private final Map<String, ChatClient> statelessCache = new ConcurrentHashMap<>();

    public LlmModelRouter(UserLlmBindingRepository bindingRepository,
                          LlmModelRepository modelRepository,
                          UserLlmModelVerifyRepository verifyRepository,
                          List<LlmVendorFactory> factories,
                          LlmVendorProps vendorProps,
                          LlmEndpointService endpointService,
                          ApiKeyCryptoService apiKeyCryptoService,
                          ChatMemory chatMemory,
                          ObjectProvider<LlmCallRecorder> recorderProvider) {
        this.bindingRepository = bindingRepository;
        this.modelRepository = modelRepository;
        this.verifyRepository = verifyRepository;
        this.factories = factories;
        this.vendorProps = vendorProps;
        this.endpointService = endpointService;
        this.apiKeyCryptoService = apiKeyCryptoService;
        this.chatMemory = chatMemory;
        this.recorderProvider = recorderProvider;
    }

    /** 对话（同步）。 */
    public String chat(Long userId, String vendor, String modelCode, String conversationId, String message) {
        ChatClient chatClient = resolveChatClient(userId, vendor, modelCode, true);
        String memoryKey = memoryKey(userId, conversationId);
        long start = System.currentTimeMillis();
        try {
            ChatResponse response = chatClient.prompt()
                    .user(message)
                    .advisors(a -> a.param(ChatMemory.CONVERSATION_ID, memoryKey))
                    .call()
                    .chatResponse();
            String content = response.getResult() == null || response.getResult().getOutput() == null
                    ? "" : Objects.requireNonNullElse(response.getResult().getOutput().getText(), "");
            record(userId, vendor, modelCode, conversationId, start, usageOf(response),
                    message, content, "success", null, null);
            return content;
        } catch (RuntimeException e) {
            record(userId, vendor, modelCode, conversationId, start, null,
                    message, null, "error", "CALL_FAILED", e.getMessage());
            throw wrap(e);
        }
    }

    /**
     * 对话（流式）：返回逐 token 的回复增量，首 token 到达即推送，显著降低首响应时延。
     * 记忆顾问仍按会话 id 在 after 阶段落库，跨调用上下文连续。
     */
    public Flux<String> stream(Long userId, String vendor, String modelCode, String conversationId, String message) {
        ChatClient chatClient = resolveChatClient(userId, vendor, modelCode, true);
        String memoryKey = memoryKey(userId, conversationId);
        return streamAndRecord(chatClient, userId, vendor, modelCode, conversationId, message,
                a -> a.param(ChatMemory.CONVERSATION_ID, memoryKey));
    }

    /**
     * 无记忆同步调用：上下文压缩生成摘要等内部场景使用。
     */
    public String chatStateless(Long userId, String vendor, String modelCode, String message) {
        ChatClient chatClient = resolveStatelessChatClient(userId, vendor, modelCode, true);
        long start = System.currentTimeMillis();
        try {
            ChatResponse response = chatClient.prompt().user(message).call().chatResponse();
            String content = response.getResult() == null || response.getResult().getOutput() == null
                    ? "" : Objects.requireNonNullElse(response.getResult().getOutput().getText(), "");
            record(userId, vendor, modelCode, null, start, usageOf(response),
                    message, content, "success", null, null);
            return content;
        } catch (RuntimeException e) {
            record(userId, vendor, modelCode, null, start, null,
                    message, null, "error", "CALL_FAILED", e.getMessage());
            throw wrap(e);
        }
    }

    /**
     * 单模型连通性探测：不要求用户已绑定，使用调用方给出的 AK（草稿 / 已保存 / 系统兜底均可）。
     * <p>会走一次真实调用并落监控记录，供「先校验、后绑定」使用。</p>
     */
    public void probeUnbound(Long userId, String vendor, String modelCode, String apiKey, String baseUrl) {
        LlmModel model = modelRepository.findByVendorCodeAndModelCode(vendor, modelCode)
                .filter(m -> Boolean.TRUE.equals(m.getEnabled()))
                .orElseThrow(() -> new BusinessException(ErrorCode.PARAMS_ERROR, "模型不存在或未上架"));
        if (!StringUtils.hasText(apiKey)) {
            throw new BusinessException(ErrorCode.SYSTEM_ERROR, "该模型未配置密钥");
        }
        String cacheKey = "verify:" + userId + ":" + vendor + ":" + modelCode + ":"
                + apiKeyCryptoService.fingerprint(apiKey) + ":" + apiKeyCryptoService.fingerprint(baseUrl);
        ChatClient chatClient = statelessCache.computeIfAbsent(cacheKey, k ->
                ChatClient.builder(createModel(new Resolved(model, apiKey.trim(), baseUrl), vendor)).build());
        long start = System.currentTimeMillis();
        String prompt = "连通性测试，请只回复 OK";
        try {
            ChatResponse response = chatClient.prompt().user(prompt).call().chatResponse();
            String content = response.getResult() == null || response.getResult().getOutput() == null
                    ? "" : Objects.requireNonNullElse(response.getResult().getOutput().getText(), "");
            record(userId, vendor, modelCode, null, start, usageOf(response),
                    prompt, content, "success", null, null);
        } catch (RuntimeException e) {
            record(userId, vendor, modelCode, null, start, null,
                    prompt, null, "error", "VERIFY_FAILED", e.getMessage());
            throw e;
        }
    }

    /**
     * 无记忆流式调用：搜索 AI 等一次性问答使用。
     * <p>不挂 {@link MessageChatMemoryAdvisor}，因此不会读写任何 conversationId 的历史。</p>
     */
    public Flux<String> streamStateless(Long userId, String vendor, String modelCode, String message) {
        ChatClient chatClient = resolveStatelessChatClient(userId, vendor, modelCode, true);
        return streamAndRecord(chatClient, userId, vendor, modelCode, null, message, a -> {
        });
    }

    /**
     * 流式调用统一实现：边下发增量边捕获 usage（部分厂商只在最后一个 chunk 给 usage）。
     * 完成/失败/取消都会落一条调用记录；记录失败不影响对话主链路。
     */
    private Flux<String> streamAndRecord(ChatClient chatClient, Long userId, String vendor, String modelCode,
                                         String conversationId, String message,
                                         java.util.function.Consumer<ChatClient.AdvisorSpec> advisors) {
        long start = System.currentTimeMillis();
        AtomicReference<Usage> usageRef = new AtomicReference<>();
        AtomicBoolean recorded = new AtomicBoolean(false);
        StringBuilder completion = new StringBuilder();
        return chatClient.prompt()
                .user(message)
                .advisors(advisors)
                .stream()
                .chatResponse()
                .doOnNext(response -> {
                    Usage usage = usageOf(response);
                    if (usage != null) {
                        usageRef.set(usage);
                    }
                    String delta = response.getResult() == null || response.getResult().getOutput() == null
                            ? "" : Objects.requireNonNullElse(response.getResult().getOutput().getText(), "");
                    completion.append(delta);
                })
                .map(response -> response.getResult() == null || response.getResult().getOutput() == null
                        ? "" : Objects.requireNonNullElse(response.getResult().getOutput().getText(), ""))
                .filter(delta -> !delta.isEmpty())
                .doOnComplete(() -> {
                    if (recorded.compareAndSet(false, true)) {
                        record(userId, vendor, modelCode, conversationId, start, usageRef.get(),
                                message, completion.toString(), "success", null, null);
                    }
                })
                .doOnCancel(() -> {
                    if (recorded.compareAndSet(false, true)) {
                        record(userId, vendor, modelCode, conversationId, start, usageRef.get(),
                                message, completion.toString(), "error", "CANCELLED", "客户端取消");
                    }
                })
                .doOnError(e -> {
                    if (recorded.compareAndSet(false, true)) {
                        record(userId, vendor, modelCode, conversationId, start, usageRef.get(),
                                message, completion.toString(), "error", "CALL_FAILED", e.getMessage());
                    }
                })
                .onErrorMap(LlmModelRouter::wrap);
    }

    /** 校验绑定/模型/密钥，并返回（缓存）对应的 ChatClient */
    private ChatClient resolveChatClient(Long userId, String vendor, String modelCode, boolean requireValid) {
        Resolved resolved = resolve(userId, vendor, modelCode, requireValid);
        String cacheKey = cacheKey(userId, vendor, modelCode, resolved);
        return cache.computeIfAbsent(cacheKey, k -> {
            ChatModel rawModel = createModel(resolved, vendor);
            return ChatClient.builder(rawModel)
                    .defaultAdvisors(MessageChatMemoryAdvisor.builder(chatMemory).build())
                    .build();
        });
    }

    /** 无记忆客户端：与对话客户端使用同一套绑定/模型校验，但不挂记忆顾问。 */
    private ChatClient resolveStatelessChatClient(Long userId, String vendor, String modelCode, boolean requireValid) {
        Resolved resolved = resolve(userId, vendor, modelCode, requireValid);
        String cacheKey = "stateless:" + cacheKey(userId, vendor, modelCode, resolved);
        return statelessCache.computeIfAbsent(cacheKey, k -> {
            ChatModel rawModel = createModel(resolved, vendor);
            return ChatClient.builder(rawModel).build();
        });
    }

    /**
     * 绑定 + 模型 + 密钥解析。
     * <p>用户自持 AK 优先；解密失败直接 50000，不调用上游；无用户 AK 时回落配置文件；都没有则 50000。</p>
     * <p>{@code requireValid=true} 时未通过连通校验的绑定不可用于对话。</p>
     */
    private Resolved resolve(Long userId, String vendor, String modelCode, boolean requireValid) {
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
        LlmEndpointService.EffectiveEndpoint endpoint = endpointService.resolveSaved(userId, vendor);
        String fingerprint = endpointService.targetFingerprint(apiKey, endpoint);
        if (requireValid && !verified(userId, vendor, modelCode, fingerprint)) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "模型未通过连通校验，请先在模型配置页校验");
        }
        return new Resolved(model, apiKey.trim(), endpoint.baseUrl());
    }

    /** 校验结论必须有效，且必须是用「当前这把 Key」校验出来的 */
    private boolean verified(Long userId, String vendor, String modelCode, String fingerprint) {
        return verifyRepository.findByUserIdAndVendorCodeAndModelCode(userId, vendor, modelCode)
                .map(v -> Boolean.TRUE.equals(v.getIsValid())
                        && fingerprint != null
                        && fingerprint.equals(v.getKeyFingerprint()))
                .orElse(false);
    }

    private ChatModel createModel(Resolved resolved, String vendor) {
        LlmVendorFactory factory = factories.stream()
                .filter(f -> f.supports(vendor))
                .findFirst()
                .orElseThrow(() -> new BusinessException(ErrorCode.SYSTEM_ERROR, "不支持的厂商"));
        return factory.create(resolved.model(), resolved.apiKey(), resolved.baseUrl());
    }

    /** 缓存键含用户、Key 指纹与调用根地址：换 Key / 换业务空间 / 换地域都不会复用旧实例 */
    private String cacheKey(Long userId, String vendor, String modelCode, Resolved resolved) {
        return userId + ":" + vendor + ":" + modelCode
                + ":" + apiKeyCryptoService.fingerprint(resolved.apiKey())
                + ":" + apiKeyCryptoService.fingerprint(resolved.baseUrl());
    }

    /** 会话隔离：记忆主键 = userId + 会话 id，跨用户、跨会话互不串扰 */
    public static String memoryKey(Long userId, String conversationId) {
        return userId + ":" + (conversationId == null || conversationId.isBlank() ? "default" : conversationId);
    }

    private static Usage usageOf(ChatResponse response) {
        if (response == null || response.getMetadata() == null) {
            return null;
        }
        Usage usage = response.getMetadata().getUsage();
        return usage == null ? null : usage;
    }

    /**
     * 落一条 LLM 调用记录：供应商 usage 优先，缺失时按字符估算（中文≈1 字 1 token，其他≈4 字符 1 token）。
     * 记录模块异常一律吞掉，绝不影响对话。
     */
    private void record(Long userId, String vendor, String modelCode, String conversationId,
                        long start, Usage usage, String promptText, String completionText,
                        String status, String errorCode, String errorMessage) {
        LlmCallRecorder recorder = recorderProvider.getIfAvailable();
        if (recorder == null) {
            return;
        }
        try {
            Integer prompt = usage == null ? null : usage.getPromptTokens();
            Integer completion = usage == null ? null : usage.getCompletionTokens();
            String source = prompt != null ? "provider" : "estimated";
            if (prompt == null) {
                prompt = estimateTokens(promptText);
            }
            if (completion == null) {
                completion = estimateTokens(completionText);
            }
            Integer total = prompt + completion;
            recorder.record(new LlmCallRecord(
                    userId, vendor, modelCode, conversationId,
                    prompt, completion, total, source,
                    (int) Math.min(Integer.MAX_VALUE, System.currentTimeMillis() - start),
                    status, errorCode, truncate(errorMessage, 500),
                    promptText, completionText));
        } catch (RuntimeException ignored) {
            // 监控是旁路，失败不能影响主链路
        }
    }

    /** 粗略 token 估算：CJK 字符按 1 token，其余按 4 字符 1 token */
    static int estimateTokens(String text) {
        return TokenEstimator.estimate(text);
    }

    private static String truncate(String value, int max) {
        if (value == null) {
            return null;
        }
        return value.length() <= max ? value : value.substring(0, max);
    }

    private static BusinessException wrap(Throwable e) {
        String detail = e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
        return new BusinessException(ErrorCode.SYSTEM_ERROR, "模型调用失败：" + detail);
    }

    private record Resolved(LlmModel model, String apiKey, String baseUrl) {
    }
}
