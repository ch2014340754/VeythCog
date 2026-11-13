package com.vc.llm.service;

import com.vc.common.exception.BusinessException;
import com.vc.common.exception.ErrorCode;
import com.vc.llm.config.DashScopeEndpoint;
import com.vc.llm.config.LlmVendorProps;
import com.vc.llm.crypto.ApiKeyCryptoService;
import com.vc.llm.dto.BatchBindResult;
import com.vc.llm.dto.CatalogModelItem;
import com.vc.llm.dto.CatalogVendorItem;
import com.vc.llm.dto.LlmModelItem;
import com.vc.llm.dto.VendorKeyStatus;
import com.vc.llm.entity.LlmModel;
import com.vc.llm.entity.UserLlmBinding;
import com.vc.llm.entity.UserLlmModelVerify;
import com.vc.llm.enums.LlmVendor;
import com.vc.llm.model.ModelModalities;
import com.vc.llm.model.ModelType;
import com.vc.llm.repository.LlmModelRepository;
import com.vc.llm.repository.UserLlmBindingRepository;
import com.vc.llm.repository.UserLlmModelVerifyRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

/**
 * 模型管理服务：绑定查询 / 目录 / 绑定 / 解绑 / 设默认 / 用户自持 AK。
 *
 * <p>AK 语义为「用户 + 供应商」级：同一 vendor 下所有绑定行共享同一份密文，
 * 为 NULL 时回落到配置文件 AK。任何对外响应都不包含明文 Key。</p>
 */
@Service
public class LlmModelService {

    private final LlmModelRepository modelRepository;
    private final LlmVendorProps vendorProps;
    private final LlmEndpointService endpointService;
    private final UserLlmBindingRepository bindingRepository;
    private final UserLlmModelVerifyRepository verifyRepository;
    private final ApiKeyCryptoService apiKeyCryptoService;

    public LlmModelService(LlmModelRepository modelRepository,
                           LlmVendorProps vendorProps,
                           LlmEndpointService endpointService,
                           UserLlmBindingRepository bindingRepository,
                           UserLlmModelVerifyRepository verifyRepository,
                           ApiKeyCryptoService apiKeyCryptoService) {
        this.modelRepository = modelRepository;
        this.vendorProps = vendorProps;
        this.endpointService = endpointService;
        this.bindingRepository = bindingRepository;
        this.verifyRepository = verifyRepository;
        this.apiKeyCryptoService = apiKeyCryptoService;
    }

    /** 当前用户绑定的、启用且已通过连通校验的对话模型（对话页下拉，按绑定创建时间升序） */
    public List<LlmModelItem> getModels(Long userId) {
        List<LlmModelItem> items = new ArrayList<>();
        Map<String, String> fingerprints = vendorFingerprints(userId);
        for (UserLlmBinding b : bindingRepository.findByUserIdOrderByCreateTimeAscIdAsc(userId)) {
            if (!Boolean.TRUE.equals(b.getEnabled())) {
                continue;
            }
            LlmModel model = modelRepository.findByVendorCodeAndModelCode(b.getVendorCode(), b.getModelCode())
                    .filter(m -> Boolean.TRUE.equals(m.getEnabled()))
                    .orElse(null);
            if (model == null) {
                continue;
            }
            ModelType type = ModelType.fromCode(model.getModelType());
            if (!type.isChatCapable()) {
                continue;
            }
            if (!verified(userId, b.getVendorCode(), b.getModelCode(),
                    fingerprints.get(b.getVendorCode()))) {
                continue;
            }
            items.add(new LlmModelItem(b.getVendorCode(), b.getModelCode(), model.getModelName(),
                    type.getCode(), ModelModalities.decode(model.getModalities(), model.getModelType()),
                    true, Boolean.TRUE.equals(b.getIsDefault())));
        }
        return items;
    }

    /** 当前用户默认模型；没有显式默认时回退到第一个已绑定模型。 */
    public LlmModelItem getDefaultModel(Long userId) {
        List<LlmModelItem> models = getModels(userId);
        return models.stream()
                .filter(m -> Boolean.TRUE.equals(m.getIsDefault()))
                .findFirst()
                .orElse(models.isEmpty() ? null : models.get(0));
    }

    /** 供应商枚举 + 模型目录（含绑定/默认标记 + 校验结论 + 用户 Key 状态） */
    public List<CatalogVendorItem> getCatalog(Long userId) {
        List<LlmVendor> vendors = Arrays.stream(LlmVendor.values()).toList();

        Set<String> boundKeys = new HashSet<>();
        Set<String> defaultKeys = new HashSet<>();
        for (UserLlmBinding b : bindingRepository.findByUserId(userId)) {
            if (Boolean.TRUE.equals(b.getEnabled())) {
                boundKeys.add(key(b.getVendorCode(), b.getModelCode()));
                if (Boolean.TRUE.equals(b.getIsDefault())) {
                    defaultKeys.add(key(b.getVendorCode(), b.getModelCode()));
                }
            }
        }
        Map<String, UserLlmModelVerify> verifies = new HashMap<>();
        for (UserLlmModelVerify v : verifyRepository.findByUserId(userId)) {
            verifies.put(key(v.getVendorCode(), v.getModelCode()), v);
        }
        Map<String, String> fingerprints = vendorFingerprints(userId);

        List<CatalogVendorItem> result = new ArrayList<>();
        for (LlmVendor v : vendors) {
            String vCode = v.getCode();
            String vendorFingerprint = fingerprints.get(vCode);
            List<CatalogModelItem> models = modelRepository.findByVendorCodeAndEnabledTrue(vCode)
                    .stream()
                    .map(m -> {
                        UserLlmModelVerify verify = verifies.get(key(vCode, m.getModelCode()));
                        boolean valid = verify != null
                                && Boolean.TRUE.equals(verify.getIsValid())
                                && vendorFingerprint != null
                                && vendorFingerprint.equals(verify.getKeyFingerprint());
                        return new CatalogModelItem(
                                m.getModelCode(), m.getModelName(),
                                ModelType.fromCode(m.getModelType()).getCode(),
                                ModelModalities.decode(m.getModalities(), m.getModelType()),
                                boundKeys.contains(key(vCode, m.getModelCode())),
                                defaultKeys.contains(key(vCode, m.getModelCode())),
                                true,
                                valid,
                                verify == null || valid ? null : verify.getVerifyError());
                    })
                    .toList();
            VendorKeyStatus keyStatus = vendorKeyStatus(userId, vCode);
            LlmEndpointService.EffectiveEndpoint endpoint = endpointService.resolveSaved(userId, vCode);
            String savedWorkspace = null;
            String savedRegion = null;
            for (UserLlmBinding b : bindingRepository.findByUserIdAndVendorCode(userId, vCode)) {
                if (savedWorkspace == null && StringUtils.hasText(b.getWorkspaceId())) {
                    savedWorkspace = b.getWorkspaceId();
                }
                if (savedRegion == null && StringUtils.hasText(b.getRegion())) {
                    savedRegion = b.getRegion();
                }
            }
            result.add(new CatalogVendorItem(vCode, v.getName(), endpoint.baseUrl(), models,
                    keyStatus.getHasApiKey(), keyStatus.getApiKeyMasked(), keyStatus.getHasFallbackKey(),
                    savedWorkspace, savedRegion,
                    endpoint.workspaceId(), endpoint.region(),
                    StringUtils.hasText(vendorProps.workspaceId(vCode)),
                    endpoint.baseUrl()));
        }
        return result;
    }

    /** 每个供应商当前有效 Key 的指纹：已保存 AK 优先，其次配置兜底；解密失败视为无 Key */
    private Map<String, String> vendorFingerprints(Long userId) {
        Map<String, String> result = new HashMap<>();
        for (LlmVendor v : LlmVendor.values()) {
            String vendor = v.getCode();
            String plain = null;
            Optional<UserLlmBinding> latest = bindingRepository.findByUserIdAndVendorCode(userId, vendor)
                    .stream()
                    .filter(b -> StringUtils.hasText(b.getApiKeyCipher()))
                    .max((a, b) -> {
                        LocalDateTime ta = a.getApiKeyUpdatedAt() == null ? LocalDateTime.MIN : a.getApiKeyUpdatedAt();
                        LocalDateTime tb = b.getApiKeyUpdatedAt() == null ? LocalDateTime.MIN : b.getApiKeyUpdatedAt();
                        return ta.compareTo(tb);
                    });
            if (latest.isPresent()) {
                try {
                    plain = apiKeyCryptoService.decrypt(latest.get().getApiKeyCipher());
                } catch (BusinessException ignored) {
                    plain = null;
                }
            }
            if (!StringUtils.hasText(plain)) {
                plain = vendorProps.apiKey(vendor);
            }
            if (StringUtils.hasText(plain)) {
                LlmEndpointService.EffectiveEndpoint endpoint = endpointService.resolveSaved(userId, vendor);
                result.put(vendor, endpointService.targetFingerprint(plain, endpoint));
            }
        }
        return result;
    }

    private boolean verified(Long userId, String vendor, String modelCode, String fingerprint) {
        return verifyRepository.findByUserIdAndVendorCodeAndModelCode(userId, vendor, modelCode)
                .map(v -> Boolean.TRUE.equals(v.getIsValid())
                        && fingerprint != null
                        && fingerprint.equals(v.getKeyFingerprint()))
                .orElse(false);
    }

    /** 绑定模型（兼容旧接口）；重复绑定幂等；isDefault=true 时清其他默认 */
    @Transactional
    public boolean bind(Long userId, String vendor, String modelCode, Boolean isDefault) {
        LlmModel model = requireModel(vendor, modelCode);
        List<UserLlmBinding> siblings = bindingRepository.findByUserIdAndVendorCode(userId, model.getVendorCode());
        UserLlmBinding binding = bindingRepository
                .findByUserIdAndVendorCodeAndModelCode(userId, model.getVendorCode(), modelCode)
                .orElseGet(() -> {
                    UserLlmBinding nb = new UserLlmBinding();
                    nb.setUserId(userId);
                    nb.setVendorCode(model.getVendorCode());
                    nb.setModelCode(modelCode);
                    // 新绑定继承该供应商已有的用户 AK（如有），保持「用户 + 供应商」级一致
                    inheritCipher(siblings).ifPresent(c -> {
                        nb.setApiKeyCipher(c.getApiKeyCipher());
                        nb.setApiKeyUpdatedAt(c.getApiKeyUpdatedAt());
                    });
                    // 业务空间 / 地域同样是「用户 + 供应商」级，新绑定继承已有值
                    siblings.stream()
                            .filter(s -> StringUtils.hasText(s.getWorkspaceId()) || StringUtils.hasText(s.getRegion()))
                            .findFirst()
                            .ifPresent(s -> {
                                nb.setWorkspaceId(s.getWorkspaceId());
                                nb.setRegion(s.getRegion());
                            });
                    return nb;
                });
        if (Boolean.TRUE.equals(isDefault)) {
            clearDefaults(userId);
        }
        binding.setEnabled(true);
        if (isDefault != null) {
            binding.setIsDefault(isDefault);
        }
        bindingRepository.save(binding);
        return true;
    }

    /**
     * 批量绑定：某供应商下的「多选模型 + 可选新 AK + 可选默认模型」，单事务。
     * <ul>
     *   <li>{@code modelCodes} 为空 → 清空该供应商下的全部绑定；</li>
     *   <li>{@code apiKey} 非空 → 加密后写入该 vendor 全部绑定行；为空则保留原密文；</li>
     *   <li>未选中的旧绑定删除；{@code defaultModelCode} 必须来自选中集合。</li>
     * </ul>
     */
    @Transactional
    public BatchBindResult batchBind(Long userId, String vendor, List<String> modelCodes,
                                     String apiKey, String defaultModelCode,
                                     String workspaceId, String region) {
        String vendorCode = requireVendor(vendor);
        List<String> codes = normalizeCodes(modelCodes);
        for (String code : codes) {
            requireModel(vendorCode, code);
        }

        // 业务空间 / 地域与 AK 同级：null=不修改，空串=清除用户设置并回落系统配置
        String workspaceToUse = workspaceId == null
                ? null : DashScopeEndpoint.normalizeWorkspace(workspaceId);
        String regionToUse = region == null ? null : DashScopeEndpoint.normalizeRegion(region);

        List<UserLlmBinding> existing = bindingRepository.findByUserIdAndVendorCode(userId, vendorCode);
        UserLlmBinding workspaceSeed = existing.stream()
                .filter(b -> StringUtils.hasText(b.getWorkspaceId()) || StringUtils.hasText(b.getRegion()))
                .findFirst()
                .orElse(null);
        if (codes.isEmpty() && StringUtils.hasText(apiKey)) {
            // AK 是按绑定行存储的（用户 + 供应商级），没有模型就无处落库，直接拒绝而不是假装成功
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "请至少选择一个模型后再保存 API Key");
        }
        Optional<UserLlmBinding> inherited = inheritCipher(existing);

        String cipherToUse = inherited.map(UserLlmBinding::getApiKeyCipher).orElse(null);
        LocalDateTime updatedAt = inherited.map(UserLlmBinding::getApiKeyUpdatedAt).orElse(null);
        String masked;
        if (StringUtils.hasText(apiKey)) {
            String plain = apiKey.trim();
            cipherToUse = apiKeyCryptoService.encrypt(plain);
            updatedAt = LocalDateTime.now();
            masked = apiKeyCryptoService.mask(plain);
        } else {
            masked = cipherToUse == null ? null : apiKeyCryptoService.maskCipherOrMasked(cipherToUse);
        }

        // 1. 删除本次未选中的旧绑定
        List<UserLlmBinding> toDelete = existing.stream()
                .filter(b -> !codes.contains(b.getModelCode()))
                .toList();
        if (!toDelete.isEmpty()) {
            bindingRepository.deleteAll(toDelete);
        }

        // 2. 新增 / 更新选中模型（本次换 Key 时整组同步密文）
        for (String code : codes) {
            Optional<UserLlmBinding> exist = existing.stream()
                    .filter(b -> b.getModelCode().equals(code))
                    .findFirst();
            UserLlmBinding binding = exist.orElseGet(() -> {
                UserLlmBinding nb = new UserLlmBinding();
                nb.setUserId(userId);
                nb.setVendorCode(vendorCode);
                nb.setModelCode(code);
                if (workspaceId == null && workspaceSeed != null) {
                    nb.setWorkspaceId(workspaceSeed.getWorkspaceId());
                }
                if (region == null && workspaceSeed != null) {
                    nb.setRegion(workspaceSeed.getRegion());
                }
                return nb;
            });
            binding.setEnabled(true);
            if (workspaceId != null) {
                binding.setWorkspaceId(workspaceToUse);
            }
            if (region != null) {
                binding.setRegion(regionToUse);
            }
            if (cipherToUse != null && !Objects.equals(binding.getApiKeyCipher(), cipherToUse)) {
                binding.setApiKeyCipher(cipherToUse);
                binding.setApiKeyUpdatedAt(updatedAt);
            }
            bindingRepository.save(binding);
        }

        // 3. 默认模型：显式指定 > 保留原默认 > 落到第一个；空集合则无默认
        String currentDefault = existing.stream()
                .filter(b -> Boolean.TRUE.equals(b.getIsDefault()))
                .map(UserLlmBinding::getModelCode)
                .findFirst()
                .orElse(null);
        String targetDefault;
        if (StringUtils.hasText(defaultModelCode)) {
            if (!codes.contains(defaultModelCode)) {
                throw new BusinessException(ErrorCode.PARAMS_ERROR, "默认模型必须来自本次选中的模型");
            }
            targetDefault = defaultModelCode;
        } else if (currentDefault != null && codes.contains(currentDefault)) {
            targetDefault = currentDefault;
        } else {
            targetDefault = codes.isEmpty() ? null : codes.get(0);
        }
        clearDefaults(userId);
        if (targetDefault != null) {
            bindingRepository.findByUserIdAndVendorCodeAndModelCode(userId, vendorCode, targetDefault)
                    .ifPresent(b -> {
                        b.setIsDefault(true);
                        bindingRepository.save(b);
                    });
        }

        return new BatchBindResult(vendorCode, codes, !codes.isEmpty() && cipherToUse != null,
                codes.isEmpty() ? null : masked);
    }

    /** 单独编辑用户 AK（写入该供应商下的全部绑定行） */
    @Transactional
    public VendorKeyStatus updateVendorKey(Long userId, String vendor, String apiKey) {
        String vendorCode = requireVendor(vendor);
        if (!StringUtils.hasText(apiKey)) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "API Key 不能为空");
        }
        List<UserLlmBinding> bindings = bindingRepository.findByUserIdAndVendorCode(userId, vendorCode);
        if (bindings.isEmpty()) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "请先绑定该供应商下的模型");
        }
        String cipher = apiKeyCryptoService.encrypt(apiKey.trim());
        LocalDateTime now = LocalDateTime.now();
        for (UserLlmBinding b : bindings) {
            b.setApiKeyCipher(cipher);
            b.setApiKeyUpdatedAt(now);
        }
        bindingRepository.saveAll(bindings);
        return vendorKeyStatus(userId, vendorCode);
    }

    /** 清除用户 AK，回落配置文件兜底 */
    @Transactional
    public VendorKeyStatus clearVendorKey(Long userId, String vendor) {
        String vendorCode = requireVendor(vendor);
        List<UserLlmBinding> bindings = bindingRepository.findByUserIdAndVendorCode(userId, vendorCode);
        for (UserLlmBinding b : bindings) {
            b.setApiKeyCipher(null);
            b.setApiKeyUpdatedAt(null);
        }
        if (!bindings.isEmpty()) {
            bindingRepository.saveAll(bindings);
        }
        return vendorKeyStatus(userId, vendorCode);
    }

    /** 供应商维度 Key 状态（脱敏，不含明文） */
    public VendorKeyStatus vendorKeyStatus(Long userId, String vendor) {
        LlmVendor v = LlmVendor.fromCode(vendor);
        String vendorCode = v == null ? vendor : v.getCode();
        Optional<UserLlmBinding> withKey = inheritCipher(
                bindingRepository.findByUserIdAndVendorCode(userId, vendorCode));
        String masked = withKey.map(b -> apiKeyCryptoService.maskCipherOrMasked(b.getApiKeyCipher())).orElse(null);
        boolean hasFallback = StringUtils.hasText(vendorProps.apiKey(vendorCode));
        return new VendorKeyStatus(withKey.isPresent(), masked, hasFallback);
    }

    /** 解绑模型 */
    @Transactional
    public boolean unbind(Long userId, String vendor, String modelCode) {
        bindingRepository.findByUserIdAndVendorCodeAndModelCode(userId, vendor, modelCode)
                .orElseThrow(() -> new BusinessException(ErrorCode.PARAMS_ERROR, "绑定不存在"));
        bindingRepository.deleteByUserIdAndVendorCodeAndModelCode(userId, vendor, modelCode);
        return true;
    }

    /** 设为默认模型（清掉该用户其他默认） */
    @Transactional
    public boolean setDefault(Long userId, String vendor, String modelCode) {
        UserLlmBinding binding = bindingRepository
                .findByUserIdAndVendorCodeAndModelCode(userId, vendor, modelCode)
                .orElseThrow(() -> new BusinessException(ErrorCode.PARAMS_ERROR, "未绑定该模型"));
        clearDefaults(userId);
        binding.setIsDefault(true);
        bindingRepository.save(binding);
        return true;
    }

    private LlmModel requireModel(String vendor, String modelCode) {
        String vendorCode = requireVendor(vendor);
        if (!StringUtils.hasText(modelCode)) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "模型不存在");
        }
        LlmModel model = modelRepository.findByVendorCodeAndModelCode(vendorCode, modelCode.trim())
                .orElseThrow(() -> new BusinessException(ErrorCode.PARAMS_ERROR, "模型不存在"));
        if (!Boolean.TRUE.equals(model.getEnabled())) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "模型未启用");
        }
        return model;
    }

    private String requireVendor(String vendor) {
        LlmVendor v = LlmVendor.fromCode(vendor);
        if (v == null) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "未知供应商");
        }
        return v.getCode();
    }

    private static List<String> normalizeCodes(List<String> modelCodes) {
        if (modelCodes == null) {
            return List.of();
        }
        return modelCodes.stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .distinct()
                .toList();
    }

    /** 取该组绑定中最近一次写入的非空密文（用户 + 供应商级 AK 的唯一权威值） */
    private static Optional<UserLlmBinding> inheritCipher(List<UserLlmBinding> bindings) {
        return bindings.stream()
                .filter(b -> StringUtils.hasText(b.getApiKeyCipher()))
                .max((a, b) -> {
                    LocalDateTime ta = a.getApiKeyUpdatedAt() == null ? LocalDateTime.MIN : a.getApiKeyUpdatedAt();
                    LocalDateTime tb = b.getApiKeyUpdatedAt() == null ? LocalDateTime.MIN : b.getApiKeyUpdatedAt();
                    return ta.compareTo(tb);
                });
    }

    private void clearDefaults(Long userId) {
        for (UserLlmBinding b : bindingRepository.findByUserId(userId)) {
            if (Boolean.TRUE.equals(b.getIsDefault())) {
                b.setIsDefault(false);
                bindingRepository.save(b);
            }
        }
    }

    private String key(String vendor, String modelCode) {
        return vendor + ":" + modelCode;
    }
}
