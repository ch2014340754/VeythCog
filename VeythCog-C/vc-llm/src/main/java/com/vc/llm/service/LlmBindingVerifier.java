package com.vc.llm.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.vc.common.exception.BusinessException;
import com.vc.common.exception.ErrorCode;
import com.vc.llm.config.DashScopeEndpoint;
import com.vc.llm.config.LlmVendorProps;
import com.vc.llm.crypto.ApiKeyCryptoService;
import com.vc.llm.dto.VerifyResult;
import com.vc.llm.entity.LlmModel;
import com.vc.llm.entity.UserLlmBinding;
import com.vc.llm.entity.UserLlmModelVerify;
import com.vc.llm.enums.LlmVendor;
import com.vc.llm.model.ModelType;
import com.vc.llm.repository.LlmModelRepository;
import com.vc.llm.repository.UserLlmBindingRepository;
import com.vc.llm.repository.UserLlmModelVerifyRepository;
import com.vc.llm.router.LlmModelRouter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

/**
 * 单模型连通性校验：<b>不要求用户先绑定</b>，通过后可自由决定是否绑定。
 *
 * <p>Key 解析顺序：本次请求携带的草稿 AK → 用户该供应商已保存的 AK → 配置文件兜底 AK。
 * 校验结论写入 {@code user_llm_model_verify}，并记录所用 Key 指纹；对话时指纹不一致即视为未校验。</p>
 *
 * <p>探测方式按模型类型区分：文本/推理/全模态走 OpenAI 兼容 chat 请求；百炼多模态理解（VU）
 * 走原生 multimodal-generation URL；图像/视频/语音/向量模型只做「账号模型列表可见」确认，
 * 不发起昂贵的生成调用。</p>
 */
@Service
public class LlmBindingVerifier {

    private static final Logger log = LoggerFactory.getLogger(LlmBindingVerifier.class);

    private static final HttpClient HTTP = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    /** 生成类探测（尤其多模态）单次可能十几秒，超时给足，避免把网络抖动误判为不可用 */
    private static final Duration GENERATE_TIMEOUT = Duration.ofSeconds(60);

    private static final String DASHSCOPE_MODELS_PATH = "/api/v1/models";
    private static final String SAMPLE_IMAGE =
            "https://dashscope.oss-cn-beijing.aliyuncs.com/images/dog_and_girl.jpeg";
    private static final int PAGE_SIZE = 100;
    private static final int MAX_PAGES = 10;

    private final LlmModelRouter router;
    private final LlmEndpointService endpointService;
    private final LlmModelRepository modelRepository;
    private final UserLlmBindingRepository bindingRepository;
    private final UserLlmModelVerifyRepository verifyRepository;
    private final LlmVendorProps vendorProps;
    private final ApiKeyCryptoService apiKeyCryptoService;
    private final ObjectMapper objectMapper;

    public LlmBindingVerifier(LlmModelRouter router,
                              LlmEndpointService endpointService,
                              LlmModelRepository modelRepository,
                              UserLlmBindingRepository bindingRepository,
                              UserLlmModelVerifyRepository verifyRepository,
                              LlmVendorProps vendorProps,
                              ApiKeyCryptoService apiKeyCryptoService,
                              ObjectMapper objectMapper) {
        this.router = router;
        this.endpointService = endpointService;
        this.modelRepository = modelRepository;
        this.bindingRepository = bindingRepository;
        this.verifyRepository = verifyRepository;
        this.vendorProps = vendorProps;
        this.apiKeyCryptoService = apiKeyCryptoService;
        this.objectMapper = objectMapper;
    }

    /**
     * 校验单个模型。
     *
     * @param draftApiKey      前端草稿 AK（可空）；为空时依次使用已保存 AK、系统兜底 AK
     * @param draftWorkspaceId 前端草稿业务空间（可空）；为空时依次使用已保存值、系统配置
     * @param draftRegion      前端草稿地域（可空）；为空时依次使用已保存值、系统配置
     */
    public VerifyResult verify(Long userId, String vendor, String modelCode, String draftApiKey,
                               String draftWorkspaceId, String draftRegion) {
        LlmModel model = modelRepository.findByVendorCodeAndModelCode(vendor, modelCode)
                .filter(m -> Boolean.TRUE.equals(m.getEnabled()))
                .orElseThrow(() -> new BusinessException(ErrorCode.PARAMS_ERROR, "模型不存在或未上架"));
        ModelType type = ModelType.fromCode(model.getModelType());

        long start = System.currentTimeMillis();
        LocalDateTime now = LocalDateTime.now();
        String apiKey = null;
        LlmEndpointService.EffectiveEndpoint endpoint = null;
        try {
            endpoint = endpointService.resolve(userId, vendor, draftWorkspaceId, draftRegion);
            apiKey = resolveApiKey(userId, vendor, draftApiKey);
            if (!StringUtils.hasText(apiKey)) {
                String message = "该供应商未配置可用 AK（用户 AK 与系统兜底均为空）";
                save(userId, vendor, modelCode, false, null, message, now);
                return new VerifyResult(false, message, elapsed(start), epoch(now));
            }
            String successMessage = probe(type, vendor, modelCode, userId, apiKey, endpoint.baseUrl());
            persistDraftEndpoint(userId, vendor, endpoint, draftWorkspaceId, draftRegion);
            save(userId, vendor, modelCode, true,
                    endpointService.targetFingerprint(apiKey, endpoint), null, now);
            return new VerifyResult(true, successMessage, elapsed(start), epoch(now));
        } catch (RuntimeException e) {
            String message = describe(e);
            log.warn("模型连通校验失败 user={} vendor={} model={} type={} workspace={} reason={}",
                    userId, vendor, modelCode, type.getCode(),
                    endpoint == null ? null : endpoint.workspaceId(), message);
            String fingerprint = apiKey == null || endpoint == null ? null
                    : endpointService.targetFingerprint(apiKey, endpoint);
            save(userId, vendor, modelCode, false, fingerprint, message, now);
            return new VerifyResult(false, message, elapsed(start), epoch(now));
        }
    }

    /** 按类型探测；返回给前端的成功说明 */
    private String probe(ModelType type, String vendor, String modelCode, Long userId,
                         String apiKey, String baseUrl) {
        if (type == ModelType.VISION && "dashscope".equalsIgnoreCase(vendor)) {
            probeDashScopeMultimodal(modelCode, apiKey, baseUrl);
            return "多模态模型连通校验通过";
        }
        if (type.isChatCapable()) {
            router.probeUnbound(userId, vendor, modelCode, apiKey, baseUrl);
            return "连通校验通过";
        }
        if (!type.isVerifySupported()) {
            throw new IllegalStateException("该模型类型暂不支持连通校验");
        }
        boolean visible = modelVisible(vendor, modelCode, apiKey, baseUrl);
        if (!visible) {
            throw new IllegalStateException("模型不在该账号的可用模型列表中，可能未开通或编码有误");
        }
        return "已确认模型在账号模型列表中可访问（" + type.getLabel() + "模型不发起生成调用）";
    }

    /**
     * 百炼多模态理解：走 OpenAI 兼容 chat 接口（与真实对话同一条路径），
     * 发送一张公开示例图 + 极短指令，验证 Key、模型、视觉输入链路。
     */
    private void probeDashScopeMultimodal(String modelCode, String apiKey, String baseUrl) {
        String url = DashScopeEndpoint.compatibleModeBaseUrl(baseUrl) + "/chat/completions";
        ObjectNode body = objectMapper.createObjectNode();
        body.put("model", modelCode);
        ArrayNode messages = body.putArray("messages");
        ObjectNode message = messages.addObject();
        message.put("role", "user");
        ArrayNode content = message.putArray("content");
        ObjectNode image = content.addObject();
        image.put("type", "image_url");
        image.putObject("image_url").put("url", SAMPLE_IMAGE);
        ObjectNode text = content.addObject();
        text.put("type", "text");
        text.put("text", "这张图里有什么？只回复两个字。");
        body.put("max_tokens", 16);
        JsonNode response = sendJson(url, apiKey, body, "阿里百炼多模态接口");
        JsonNode error = response.path("error");
        if (error.isObject()) {
            throw new IllegalStateException(error.path("message").asText("多模态接口返回错误"));
        }
        if (!response.path("choices").isArray() || response.path("choices").isEmpty()) {
            throw new IllegalStateException("多模态接口未返回有效结果");
        }
    }

    /** 非对话类模型：确认该模型在账号可见的模型列表中（零成本，不发起生成） */
    private boolean modelVisible(String vendor, String modelCode, String apiKey, String baseUrl) {
        if ("dashscope".equalsIgnoreCase(vendor)) {
            for (int page = 1; page <= MAX_PAGES; page++) {
                String url = baseUrl + DASHSCOPE_MODELS_PATH
                        + "?page_no=" + page + "&page_size=" + PAGE_SIZE;
                JsonNode root = getJson(url, apiKey, "阿里百炼模型列表");
                JsonNode models = root.path("output").path("models");
                if (!models.isArray() || models.isEmpty()) {
                    break;
                }
                for (JsonNode node : models) {
                    if (modelCode.equals(node.path("model").asText(""))) {
                        return true;
                    }
                }
                int total = root.path("output").path("total").asInt(0);
                if (models.size() < PAGE_SIZE || (total > 0 && page * PAGE_SIZE >= total)) {
                    break;
                }
            }
            return false;
        }
        String base = baseUrl;
        JsonNode root = getJson(base + "/models", apiKey, vendorName(vendor) + "模型列表");
        JsonNode data = root.path("data");
        if (data.isArray()) {
            for (JsonNode node : data) {
                if (modelCode.equals(node.path("id").asText(""))) {
                    return true;
                }
            }
        }
        return false;
    }

    // ---------------- Key 解析 ----------------

    /** 草稿 AK → 用户已保存 AK（取最新）→ 配置兜底 */
    private String resolveApiKey(Long userId, String vendor, String draftApiKey) {
        if (StringUtils.hasText(draftApiKey)) {
            return draftApiKey.trim();
        }
        List<UserLlmBinding> bindings = bindingRepository.findByUserIdAndVendorCode(userId, vendor);
        Optional<UserLlmBinding> latest = bindings.stream()
                .filter(b -> StringUtils.hasText(b.getApiKeyCipher()))
                .max((a, b) -> {
                    LocalDateTime ta = a.getApiKeyUpdatedAt() == null ? LocalDateTime.MIN : a.getApiKeyUpdatedAt();
                    LocalDateTime tb = b.getApiKeyUpdatedAt() == null ? LocalDateTime.MIN : b.getApiKeyUpdatedAt();
                    return ta.compareTo(tb);
                });
        if (latest.isPresent()) {
            try {
                return apiKeyCryptoService.decrypt(latest.get().getApiKeyCipher());
            } catch (BusinessException e) {
                throw new BusinessException(ErrorCode.SYSTEM_ERROR,
                        "已保存的 API Key 无法解密（加密口令可能已变更），请重新填写 AK 后校验");
            }
        }
        return vendorProps.apiKey(vendor);
    }

    /**
     * 校验通过后把本次草稿的业务空间 / 地域落到绑定行。
     *
     * <p>AK 与业务空间是「用户 + 供应商」级语义：用户用草稿业务空间校验成功后，
     * 若不同步保存，对话仍会按标准域名发起，工作空间级 Key 会一直超时或报 URL 错误。
     * 因此这里统一更新该供应商下所有绑定行，保证「校验用的地址」=「对话用的地址」。</p>
     */
    private void persistDraftEndpoint(Long userId, String vendor,
                                      LlmEndpointService.EffectiveEndpoint endpoint,
                                      String draftWorkspaceId, String draftRegion) {
        if (!StringUtils.hasText(draftWorkspaceId) && !StringUtils.hasText(draftRegion)) {
            return;
        }
        List<UserLlmBinding> bindings = bindingRepository.findByUserIdAndVendorCode(userId, vendor);
        if (bindings.isEmpty()) {
            return;
        }
        for (UserLlmBinding binding : bindings) {
            binding.setWorkspaceId(endpoint.workspaceId());
            binding.setRegion(endpoint.region());
        }
        bindingRepository.saveAll(bindings);
    }

    private void save(Long userId, String vendor, String modelCode, boolean valid,
                      String keyFingerprint, String error, LocalDateTime now) {
        UserLlmModelVerify record = verifyRepository
                .findByUserIdAndVendorCodeAndModelCode(userId, vendor, modelCode)
                .orElseGet(() -> {
                    UserLlmModelVerify v = new UserLlmModelVerify();
                    v.setUserId(userId);
                    v.setVendorCode(vendor);
                    v.setModelCode(modelCode);
                    return v;
                });
        record.setIsValid(valid);
        record.setKeyFingerprint(keyFingerprint);
        record.setVerifyError(valid ? null : truncate(error, 300));
        record.setLastVerifyAt(now);
        verifyRepository.save(record);
    }

    // ---------------- HTTP ----------------

    private JsonNode getJson(String url, String apiKey, String vendorName) {
        HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                .timeout(Duration.ofSeconds(20))
                .header("Authorization", "Bearer " + apiKey)
                .header("Accept", "application/json")
                .GET()
                .build();
        return execute(request, vendorName);
    }

    private JsonNode sendJson(String url, String apiKey, JsonNode body, String vendorName) {
        HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                .timeout(GENERATE_TIMEOUT)
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type", "application/json")
                .header("Accept", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body.toString()))
                .build();
        return execute(request, vendorName);
    }

    private JsonNode execute(HttpRequest request, String vendorName) {
        HttpResponse<String> response;
        try {
            response = HTTP.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (IOException e) {
            throw new IllegalStateException(vendorName + "请求失败：" + e.getMessage());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(vendorName + "请求被中断");
        }
        int status = response.statusCode();
        if (status / 100 != 2) {
            throw new IllegalStateException(vendorName + " HTTP " + status + " " + abbreviate(response.body()));
        }
        try {
            return objectMapper.readTree(response.body());
        } catch (IOException e) {
            throw new IllegalStateException(vendorName + "返回内容无法解析：" + e.getMessage());
        }
    }

    private String vendorName(String vendor) {
        LlmVendor v = LlmVendor.fromCode(vendor);
        return v == null ? vendor : v.getName();
    }

    // ---------------- 错误翻译 ----------------

    /**
     * 把上游报错翻译成用户能判断「该改什么」的一句话。
     *
     * <p>优先解析上游 JSON 错误体（Spring AI 透传形如 {@code 403 - {"error":{...}}}），
     * 按错误码精确区分「用完即停 / 余额不足 / 无权限 / Key 无效」；无法识别时保留上游原始
     * message，避免笼统的「额度不足」掩盖真实原因。</p>
     */
    private String describe(RuntimeException e) {
        String raw = e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
        String lower = raw.toLowerCase(Locale.ROOT);
        UpstreamError upstream = parseUpstream(raw);
        String code = upstream.code() == null ? "" : upstream.code().toLowerCase(Locale.ROOT);

        if (lower.contains("timeout") || lower.contains("timed out")) {
            return "请求超时，请检查网络或代理";
        }
        if (lower.contains("401") || code.equals("invalid_api_key")
                || lower.contains("invalid api key") || lower.contains("unauthorized")
                || lower.contains("incorrect api key")) {
            return "API Key 无效或已过期，请重新填写";
        }
        if (code.contains("freetieronly") || lower.contains("freetieronly")) {
            return "免费额度已用完且开启了「免费额度用完即停」：请在百炼控制台「免费额度」页面关闭该开关，"
                    + "确认余额到账后即可按量付费";
        }
        if (code.contains("insufficient_quota") || code.contains("insufficient_balance")
                || code.contains("quota_exceeded") || lower.contains("insufficient")
                || lower.contains("balance") || lower.contains("allocationquota")) {
            return "账户余额或调用额度不足，请充值后重试";
        }
        if (lower.contains("403")) {
            return "无该模型调用权限（上游 403）：请确认 AK 所属账号/业务空间已开通此模型";
        }
        if (lower.contains("404") || code.equals("model_not_found")
                || lower.contains("model_not_found") || lower.contains("does not exist")
                || lower.contains("model not found")) {
            return "模型不存在或该账号无权访问此模型";
        }
        if (lower.contains("429") || lower.contains("rate limit")) {
            return "触发上游限流，请稍后重试";
        }
        if (raw.contains("未配置密钥") || raw.contains("未配置可用 ak")) {
            return "该供应商未配置可用 AK（用户 AK 与系统兜底均为空）";
        }
        // 兜底：透出上游真实报错（英文 message 一并保留，便于定位）
        String detail = StringUtils.hasText(upstream.message()) ? upstream.message() : raw;
        return truncate("校验失败：" + detail, 300);
    }

    /** 从异常文本中提取上游错误体的 code / message；解析失败返回空值 */
    private UpstreamError parseUpstream(String raw) {
        if (!StringUtils.hasText(raw)) {
            return new UpstreamError(null, null);
        }
        int start = raw.indexOf('{');
        int end = raw.lastIndexOf('}');
        if (start < 0 || end <= start) {
            return new UpstreamError(null, null);
        }
        try {
            JsonNode root = objectMapper.readTree(raw.substring(start, end + 1));
            JsonNode error = root.path("error");
            JsonNode target = error.isObject() ? error : root;
            // 部分厂商只给 type 不给 code，code 缺失时回落 type
            String code = target.path("code").asText(null);
            if (!StringUtils.hasText(code)) {
                code = target.path("type").asText(null);
            }
            return new UpstreamError(code, target.path("message").asText(null));
        } catch (IOException ignore) {
            return new UpstreamError(null, null);
        }
    }

    private record UpstreamError(String code, String message) {
    }

    private static int elapsed(long start) {
        return (int) Math.min(Integer.MAX_VALUE, System.currentTimeMillis() - start);
    }

    private static long epoch(LocalDateTime time) {
        return time.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli();
    }

    private static String truncate(String value, int max) {
        return value == null || value.length() <= max ? value : value.substring(0, max);
    }

    private String abbreviate(String body) {
        if (body == null) {
            return "";
        }
        String flat = body.replaceAll("\\s+", " ");
        return flat.length() > 200 ? flat.substring(0, 200) + "…" : flat;
    }
}
