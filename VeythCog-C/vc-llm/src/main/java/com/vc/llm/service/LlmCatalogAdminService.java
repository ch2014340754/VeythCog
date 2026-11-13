package com.vc.llm.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vc.common.exception.BusinessException;
import com.vc.common.exception.ErrorCode;
import com.vc.llm.config.LlmVendorProps;
import com.vc.llm.crypto.ApiKeyCryptoService;
import com.vc.llm.dto.AdminModelItem;
import com.vc.llm.dto.ModelSyncResult;
import com.vc.llm.entity.LlmModel;
import com.vc.llm.entity.UserLlmBinding;
import com.vc.llm.enums.LlmVendor;
import com.vc.llm.repository.LlmModelRepository;
import com.vc.llm.repository.UserLlmBindingRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 管理端模型目录维护：增删改查 + 上下架 + 从供应商同步。
 *
 * <p>设计取舍：{@code llm_model} 仍是目录真源（绑定校验、默认模型、上下架都依赖它），
 * 不把用户页目录换成每次实时打供应商接口。同步只做「补齐缺失」：只增不删、不覆盖已有配置，
 * 新增行默认不上架（{@code enableNew=false}），由管理员按需开放。</p>
 *
 * <p>同步所用 AK：优先服务端兜底配置；未配置时回退到当前管理员的用户自持 AK（解密）。</p>
 */
@Service
public class LlmCatalogAdminService {

    private static final HttpClient HTTP = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    private static final String DASHSCOPE_MODELS_URL = "https://dashscope.aliyuncs.com/api/v1/models";
    private static final String DEEPSEEK_DEFAULT_BASE = "https://api.deepseek.com/v1";
    private static final int PAGE_SIZE = 100;
    private static final int MAX_PAGES = 10;
    /** 百炼 capabilities 中「TG」= Text Generation，仅同步可对话模型 */
    private static final String CAP_TEXT_GENERATION = "TG";

    private final LlmModelRepository modelRepository;
    private final UserLlmBindingRepository bindingRepository;
    private final LlmVendorProps vendorProps;
    private final ApiKeyCryptoService apiKeyCryptoService;
    private final ObjectMapper objectMapper;

    public LlmCatalogAdminService(LlmModelRepository modelRepository,
                                  UserLlmBindingRepository bindingRepository,
                                  LlmVendorProps vendorProps,
                                  ApiKeyCryptoService apiKeyCryptoService,
                                  ObjectMapper objectMapper) {
        this.modelRepository = modelRepository;
        this.bindingRepository = bindingRepository;
        this.vendorProps = vendorProps;
        this.apiKeyCryptoService = apiKeyCryptoService;
        this.objectMapper = objectMapper;
    }

    /** 全量列出（含未上架），按供应商 + id 排序 */
    public List<AdminModelItem> list() {
        Map<String, Long> counts = bindingCounts();
        return modelRepository.findAll().stream()
                .sorted(Comparator.comparing(LlmModel::getVendorCode)
                        .thenComparing((LlmModel m) -> m.getId() == null ? 0L : m.getId()))
                .map(m -> toItem(m, counts.getOrDefault(cacheKey(m.getVendorCode(), m.getModelCode()), 0L)))
                .toList();
    }

    /** 新增模型（默认上架；同名同供应商拒绝） */
    @Transactional
    public AdminModelItem create(String vendor, String modelCode, String modelName,
                                 Integer maxContextTokens, BigDecimal temperature, Boolean enabled) {
        String v = requireVendor(vendor);
        String code = requireCode(modelCode);
        if (modelRepository.findByVendorCodeAndModelCode(v, code).isPresent()) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "该供应商下已存在模型 " + code);
        }
        LlmModel m = new LlmModel();
        m.setVendorCode(v);
        m.setModelCode(code);
        m.setModelName(requireName(modelName, code));
        m.setMaxContextTokens(validContextTokens(maxContextTokens));
        m.setTemperature(validTemperature(temperature));
        m.setEnabled(enabled == null || enabled);
        return toItem(modelRepository.save(m), 0L);
    }

    /** 编辑模型：已有用户绑定则不允许改供应商/编码，其余字段可改 */
    @Transactional
    public AdminModelItem update(Long id, String vendor, String modelCode, String modelName,
                                 Integer maxContextTokens, BigDecimal temperature, Boolean enabled) {
        LlmModel m = requireModel(id);
        String v = requireVendor(vendor);
        String code = requireCode(modelCode);
        boolean identityChanged = !v.equals(m.getVendorCode()) || !code.equals(m.getModelCode());
        long bindings = bindingRepository.countByVendorCodeAndModelCode(m.getVendorCode(), m.getModelCode());
        if (identityChanged) {
            if (bindings > 0) {
                throw new BusinessException(ErrorCode.PARAMS_ERROR,
                        "该模型已被 " + bindings + " 位用户绑定，不能修改供应商或模型编码");
            }
            if (modelRepository.findByVendorCodeAndModelCode(v, code).isPresent()) {
                throw new BusinessException(ErrorCode.PARAMS_ERROR, "该供应商下已存在模型 " + code);
            }
            m.setVendorCode(v);
            m.setModelCode(code);
        }
        if (StringUtils.hasText(modelName)) {
            m.setModelName(modelName.trim());
        }
        m.setMaxContextTokens(validContextTokens(maxContextTokens));
        m.setTemperature(validTemperature(temperature));
        if (enabled != null) {
            m.setEnabled(enabled);
        }
        return toItem(modelRepository.save(m), bindings);
    }

    /** 删除模型：仍有用户绑定则拒绝（先下架让用户自行解绑） */
    @Transactional
    public boolean delete(Long id) {
        LlmModel m = requireModel(id);
        long bindings = bindingRepository.countByVendorCodeAndModelCode(m.getVendorCode(), m.getModelCode());
        if (bindings > 0) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR,
                    "该模型仍有 " + bindings + " 条用户绑定，请先下架并让用户解绑后再删除");
        }
        modelRepository.delete(m);
        return true;
    }

    /** 上架 / 下架 */
    @Transactional
    public AdminModelItem setEnabled(Long id, boolean enabled) {
        LlmModel m = requireModel(id);
        m.setEnabled(enabled);
        long bindings = bindingRepository.countByVendorCodeAndModelCode(m.getVendorCode(), m.getModelCode());
        return toItem(modelRepository.save(m), bindings);
    }

    /**
     * 从供应商拉取模型列表并补齐缺失项。
     *
     * @param enableNew 新增项是否直接上架（默认 false，先由管理员挑选）
     */
    @Transactional
    public ModelSyncResult sync(String vendor, Long adminUserId, boolean enableNew) {
        String v = requireVendor(vendor);
        String apiKey = resolveSyncKey(v, adminUserId);
        List<RemoteModel> remote = fetchRemoteModels(v, apiKey);

        Set<String> existing = new HashSet<>();
        for (LlmModel m : modelRepository.findByVendorCode(v)) {
            existing.add(m.getModelCode());
        }

        List<String> addedCodes = new ArrayList<>();
        int skipped = 0;
        for (RemoteModel r : remote) {
            if (existing.contains(r.code())) {
                skipped++;
                continue;
            }
            LlmModel m = new LlmModel();
            m.setVendorCode(v);
            m.setModelCode(r.code());
            m.setModelName(r.name());
            m.setMaxContextTokens(32768);
            m.setTemperature(new BigDecimal("0.70"));
            m.setEnabled(enableNew);
            modelRepository.save(m);
            addedCodes.add(r.code());
        }
        String vendorName = LlmVendor.fromCode(v).getName();
        String message = addedCodes.isEmpty()
                ? "供应商共 " + remote.size() + " 个可对话模型，目录已是最新"
                : "供应商共 " + remote.size() + " 个可对话模型，新增 " + addedCodes.size()
                + " 个（" + (enableNew ? "已上架" : "未上架") + "），已存在跳过 " + skipped + " 个";
        return new ModelSyncResult(v, vendorName, remote.size(), addedCodes.size(), skipped, addedCodes, message);
    }

    // ---------------- 供应商接口 ----------------

    /** 拉取供应商模型：百炼走原生 /api/v1/models（带 capabilities，可过滤非对话模型）；其余走 OpenAI 兼容 /models */
    private List<RemoteModel> fetchRemoteModels(String vendor, String apiKey) {
        return "dashscope".equals(vendor) ? fetchDashScope(apiKey) : fetchOpenAiCompatible(vendor, apiKey);
    }

    private List<RemoteModel> fetchDashScope(String apiKey) {
        List<RemoteModel> result = new ArrayList<>();
        int total = -1;
        for (int page = 1; page <= MAX_PAGES; page++) {
            String url = DASHSCOPE_MODELS_URL + "?page_no=" + page + "&page_size=" + PAGE_SIZE;
            JsonNode root = getJson(url, apiKey, "阿里百炼");
            JsonNode out = root.path("output");
            if (total < 0) {
                total = out.path("total").asInt(0);
            }
            JsonNode models = out.path("models");
            if (!models.isArray() || models.isEmpty()) {
                break;
            }
            for (JsonNode node : models) {
                if (!isTextGeneration(node.path("capabilities"))) {
                    continue;
                }
                String code = node.path("model").asText("");
                if (!StringUtils.hasText(code)) {
                    continue;
                }
                String name = node.path("name").asText(code);
                result.add(new RemoteModel(code, truncate(name)));
            }
            if (models.size() < PAGE_SIZE || (total > 0 && page * PAGE_SIZE >= total)) {
                break;
            }
        }
        return result;
    }

    private List<RemoteModel> fetchOpenAiCompatible(String vendor, String apiKey) {
        String base = vendorProps.baseUrl(vendor);
        if (!StringUtils.hasText(base)) {
            base = "deepseek".equals(vendor) ? DEEPSEEK_DEFAULT_BASE : "";
        }
        if (!StringUtils.hasText(base)) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "该供应商未配置 base-url，无法查询模型列表");
        }
        String url = (base.endsWith("/") ? base.substring(0, base.length() - 1) : base) + "/models";
        JsonNode root = getJson(url, apiKey, LlmVendor.fromCode(vendor).getName());
        List<RemoteModel> result = new ArrayList<>();
        JsonNode data = root.path("data");
        if (data.isArray()) {
            for (JsonNode node : data) {
                String code = node.path("id").asText("");
                if (!StringUtils.hasText(code)) {
                    continue;
                }
                String name = node.path("name").asText("");
                result.add(new RemoteModel(code, truncate(StringUtils.hasText(name) ? name : code)));
            }
        }
        return result;
    }

    /** 是否文本生成能力：capabilities 可能是单个字符串或数组 */
    private boolean isTextGeneration(JsonNode caps) {
        if (caps == null || caps.isMissingNode()) {
            return true;
        }
        if (caps.isTextual()) {
            return CAP_TEXT_GENERATION.equalsIgnoreCase(caps.asText());
        }
        if (caps.isArray()) {
            for (JsonNode n : caps) {
                if (CAP_TEXT_GENERATION.equalsIgnoreCase(n.asText())) {
                    return true;
                }
            }
        }
        return false;
    }

    private JsonNode getJson(String url, String apiKey, String vendorName) {
        HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                .timeout(Duration.ofSeconds(20))
                .header("Authorization", "Bearer " + apiKey)
                .header("Accept", "application/json")
                .GET()
                .build();
        HttpResponse<String> response;
        try {
            response = HTTP.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (IOException e) {
            throw new BusinessException(ErrorCode.SYSTEM_ERROR,
                    "拉取" + vendorName + "模型列表失败：" + e.getMessage());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new BusinessException(ErrorCode.SYSTEM_ERROR,
                    "拉取" + vendorName + "模型列表被中断");
        }
        int status = response.statusCode();
        if (status == 401 || status == 403) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR,
                    vendorName + "鉴权失败（HTTP " + status + "），请检查该供应商的 API Key 是否有效");
        }
        if (status / 100 != 2) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR,
                    vendorName + "返回 HTTP " + status + "：" + abbreviate(response.body()));
        }
        try {
            return objectMapper.readTree(response.body());
        } catch (IOException e) {
            throw new BusinessException(ErrorCode.SYSTEM_ERROR,
                    "解析" + vendorName + "模型列表失败：" + e.getMessage());
        }
    }

    // ---------------- 内部工具 ----------------

    private String resolveSyncKey(String vendor, Long adminUserId) {
        String configKey = vendorProps.apiKey(vendor);
        if (StringUtils.hasText(configKey)) {
            return configKey.trim();
        }
        if (adminUserId != null) {
            for (UserLlmBinding b : bindingRepository.findByUserIdAndVendorCode(adminUserId, vendor)) {
                if (StringUtils.hasText(b.getApiKeyCipher())) {
                    try {
                        return apiKeyCryptoService.decrypt(b.getApiKeyCipher());
                    } catch (BusinessException e) {
                        throw new BusinessException(ErrorCode.PARAMS_ERROR,
                                "你的 API Key 无法解密（加密口令可能已变更），请到模型配置页重新保存");
                    }
                }
            }
        }
        throw new BusinessException(ErrorCode.PARAMS_ERROR,
                "该供应商未配置 API Key，无法拉取模型列表：请先在模型配置页保存你的 AK，或在服务端配置兜底 AK");
    }

    private Map<String, Long> bindingCounts() {
        Map<String, Long> counts = new HashMap<>();
        for (Object[] row : bindingRepository.countGroupedByVendorAndModel()) {
            String key = cacheKey(String.valueOf(row[0]), String.valueOf(row[1]));
            counts.put(key, ((Number) row[2]).longValue());
        }
        return counts;
    }

    private String cacheKey(String vendor, String modelCode) {
        return vendor + ":" + modelCode;
    }

    private AdminModelItem toItem(LlmModel m, long bindingCount) {
        LlmVendor v = LlmVendor.fromCode(m.getVendorCode());
        return new AdminModelItem(m.getId(), m.getVendorCode(),
                v == null ? m.getVendorCode() : v.getName(),
                m.getModelCode(), m.getModelName(), m.getMaxContextTokens(),
                m.getTemperature(), Boolean.TRUE.equals(m.getEnabled()), bindingCount);
    }

    private LlmModel requireModel(Long id) {
        if (id == null) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "模型 id 不能为空");
        }
        return modelRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND_ERROR, "模型不存在"));
    }

    private String requireVendor(String vendor) {
        LlmVendor v = LlmVendor.fromCode(vendor);
        if (v == null) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "不支持的供应商：" + (vendor == null ? "" : vendor));
        }
        return v.getCode();
    }

    private String requireCode(String modelCode) {
        if (!StringUtils.hasText(modelCode)) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "模型编码不能为空");
        }
        String code = modelCode.trim();
        if (code.length() > 64) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "模型编码不能超过 64 个字符");
        }
        return code;
    }

    private String requireName(String modelName, String fallback) {
        String name = StringUtils.hasText(modelName) ? modelName.trim() : fallback;
        if (name.length() > 64) {
            name = name.substring(0, 64);
        }
        return name;
    }

    private int validContextTokens(Integer tokens) {
        if (tokens == null) {
            return 32768;
        }
        if (tokens < 1024 || tokens > 2_000_000) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "上下文窗口需在 1024 ~ 2000000 之间");
        }
        return tokens;
    }

    private BigDecimal validTemperature(BigDecimal temperature) {
        if (temperature == null) {
            return new BigDecimal("0.70");
        }
        if (temperature.compareTo(BigDecimal.ZERO) < 0 || temperature.compareTo(new BigDecimal("2")) > 0) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "温度需在 0 ~ 2 之间");
        }
        return temperature;
    }

    private String truncate(String text) {
        if (text == null) {
            return "";
        }
        String trimmed = text.trim();
        return trimmed.length() > 64 ? trimmed.substring(0, 64) : trimmed;
    }

    private String abbreviate(String body) {
        if (body == null) {
            return "";
        }
        String flat = body.replaceAll("\\s+", " ");
        return flat.length() > 200 ? flat.substring(0, 200) + "…" : flat;
    }

    /** 供应商返回的模型（已归一化） */
    private record RemoteModel(String code, String name) {
    }
}
