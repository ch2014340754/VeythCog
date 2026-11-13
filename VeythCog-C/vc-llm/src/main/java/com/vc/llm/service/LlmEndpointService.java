package com.vc.llm.service;

import com.vc.llm.config.DashScopeEndpoint;
import com.vc.llm.config.LlmVendorProps;
import com.vc.llm.crypto.ApiKeyCryptoService;
import com.vc.llm.entity.UserLlmBinding;
import com.vc.llm.repository.UserLlmBindingRepository;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.List;

/**
 * 解析「用户 + 供应商」当前生效的地域 / 业务空间 / 调用根地址。
 *
 * <p>优先级：本次草稿（仅校验时）→ 用户绑定行上保存的值 → 服务端配置 →
 * 默认 {@code cn-beijing}。同一供应商下多行绑定时取最近创建行上的非空值。</p>
 */
@Service
public class LlmEndpointService {

    private final UserLlmBindingRepository bindingRepository;
    private final LlmVendorProps vendorProps;
    private final ApiKeyCryptoService apiKeyCryptoService;

    public LlmEndpointService(UserLlmBindingRepository bindingRepository,
                              LlmVendorProps vendorProps,
                              ApiKeyCryptoService apiKeyCryptoService) {
        this.bindingRepository = bindingRepository;
        this.vendorProps = vendorProps;
        this.apiKeyCryptoService = apiKeyCryptoService;
    }

    public EffectiveEndpoint resolveSaved(Long userId, String vendor) {
        return resolve(userId, vendor, null, null);
    }

    /**
     * @param draftWorkspaceId 仅本次校验使用的草稿业务空间；空值回落已保存 / 配置
     * @param draftRegion      仅本次校验使用的草稿地域；空值回落已保存 / 配置 / 默认
     */
    public EffectiveEndpoint resolve(Long userId, String vendor, String draftWorkspaceId, String draftRegion) {
        String savedWorkspace = null;
        String savedRegion = null;
        if (userId != null) {
            List<UserLlmBinding> bindings = bindingRepository.findByUserIdAndVendorCode(userId, vendor);
            bindings.sort((a, b) -> {
                if (a.getCreateTime() == null && b.getCreateTime() == null) {
                    return 0;
                }
                if (a.getCreateTime() == null) {
                    return 1;
                }
                if (b.getCreateTime() == null) {
                    return -1;
                }
                return b.getCreateTime().compareTo(a.getCreateTime());
            });
            for (UserLlmBinding binding : bindings) {
                if (savedWorkspace == null && StringUtils.hasText(binding.getWorkspaceId())) {
                    savedWorkspace = binding.getWorkspaceId();
                }
                if (savedRegion == null && StringUtils.hasText(binding.getRegion())) {
                    savedRegion = binding.getRegion();
                }
            }
        }

        String workspace = StringUtils.hasText(draftWorkspaceId)
                ? DashScopeEndpoint.normalizeWorkspace(draftWorkspaceId)
                : DashScopeEndpoint.normalizeWorkspace(savedWorkspace);
        if (workspace == null) {
            workspace = DashScopeEndpoint.normalizeWorkspace(vendorProps.workspaceId(vendor));
        }

        String region = StringUtils.hasText(draftRegion)
                ? DashScopeEndpoint.normalizeRegion(draftRegion)
                : DashScopeEndpoint.normalizeRegion(savedRegion);
        if (region == null) {
            region = DashScopeEndpoint.normalizeRegion(vendorProps.region(vendor));
        }
        if (region == null) {
            region = DashScopeEndpoint.DEFAULT_REGION;
        }

        String baseUrl = DashScopeEndpoint.baseUrl(vendor, vendorProps.baseUrl(vendor), workspace, region);
        return new EffectiveEndpoint(workspace, region, baseUrl);
    }

    /**
     * 校验指纹：Key + 业务空间 + 地域一起参与。
     * <p>只换 Key 或只换工作空间都会让旧校验结论失效。</p>
     */
    public String targetFingerprint(String apiKey, EffectiveEndpoint endpoint) {
        String workspace = endpoint.workspaceId() == null ? "" : endpoint.workspaceId();
        String region = endpoint.workspaceId() == null ? "" : endpoint.region();
        String source = apiKey + "|workspace=" + workspace + "|region=" + region;
        return apiKeyCryptoService.fingerprint(source);
    }

    /** 当前生效的调用根地址（不带 /api/v1） */
    public record EffectiveEndpoint(String workspaceId, String region, String baseUrl) {
        public boolean hasWorkspace() {
            return workspaceId != null && !workspaceId.isBlank();
        }
    }
}
