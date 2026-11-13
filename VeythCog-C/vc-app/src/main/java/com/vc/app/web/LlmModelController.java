package com.vc.app.web;

import com.vc.common.BaseResponse;
import com.vc.common.ResultUtils;
import com.vc.llm.dto.BatchBindResult;
import com.vc.llm.dto.CatalogVendorItem;
import com.vc.llm.dto.LlmModelItem;
import com.vc.llm.dto.VendorKeyStatus;
import com.vc.llm.dto.VerifyResult;
import com.vc.llm.service.LlmBindingVerifier;
import com.vc.llm.service.LlmModelService;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 模型管理接口：查询绑定 / 目录 / 绑定 / 解绑 / 设默认。
 */
@RestController
@RequestMapping("/llm")
public class LlmModelController {

    private final LlmModelService llmModelService;
    private final LlmBindingVerifier llmBindingVerifier;

    public LlmModelController(LlmModelService llmModelService,
                              LlmBindingVerifier llmBindingVerifier) {
        this.llmModelService = llmModelService;
        this.llmBindingVerifier = llmBindingVerifier;
    }

    /** 我的绑定模型（对话页下拉） */
    @GetMapping("/models")
    public BaseResponse<List<LlmModelItem>> models() {
        return ResultUtils.success(llmModelService.getModels(currentUserId()));
    }

    /** 供应商枚举 + 模型目录 */
    @GetMapping("/catalog")
    public BaseResponse<List<CatalogVendorItem>> catalog() {
        return ResultUtils.success(llmModelService.getCatalog(currentUserId()));
    }

    /** 绑定模型 */
    @PostMapping("/bindings")
    public BaseResponse<Boolean> bind(@Valid @RequestBody BindRequest request) {
        return ResultUtils.success(llmModelService.bind(
                currentUserId(), request.getVendor(), request.getModelCode(), request.getIsDefault()));
    }

    /** 批量绑定：供应商 → 多选模型 + 可选新 AK + 可选默认模型 */
    @PostMapping("/bindings/batch")
    public BaseResponse<BatchBindResult> batchBind(@Valid @RequestBody BatchBindRequest request) {
        return ResultUtils.success(llmModelService.batchBind(
                currentUserId(), request.getVendor(), request.getModelCodes(),
                request.getApiKey(), request.getDefaultModelCode(),
                request.getWorkspaceId(), request.getRegion()));
    }

    /** 单独编辑某供应商的用户 AK */
    @PutMapping("/vendors/{vendor}/api-key")
    public BaseResponse<VendorKeyStatus> updateVendorKey(@PathVariable String vendor,
                                                         @Valid @RequestBody ApiKeyRequest request) {
        return ResultUtils.success(llmModelService.updateVendorKey(currentUserId(), vendor, request.getApiKey()));
    }

    /** 清除某供应商的用户 AK，回落到配置文件兜底 */
    @DeleteMapping("/vendors/{vendor}/api-key")
    public BaseResponse<VendorKeyStatus> clearVendorKey(@PathVariable String vendor) {
        return ResultUtils.success(llmModelService.clearVendorKey(currentUserId(), vendor));
    }

    /** 单模型连通校验：不要求先绑定；可携带草稿 AK，通过后再自由选择是否绑定 */
    @PostMapping({"/models/{vendor}/{modelCode}/verify", "/bindings/{vendor}/{modelCode}/verify"})
    public BaseResponse<VerifyResult> verify(@PathVariable String vendor,
                                             @PathVariable String modelCode,
                                             @RequestBody(required = false) VerifyRequest request) {
        String apiKey = request == null ? null : request.getApiKey();
        String workspaceId = request == null ? null : request.getWorkspaceId();
        String region = request == null ? null : request.getRegion();
        return ResultUtils.success(llmBindingVerifier.verify(
                currentUserId(), vendor, modelCode, apiKey, workspaceId, region));
    }

    /** 解绑模型 */
    @DeleteMapping("/bindings/{vendor}/{modelCode}")
    public BaseResponse<Boolean> unbind(@PathVariable String vendor, @PathVariable String modelCode) {
        return ResultUtils.success(llmModelService.unbind(currentUserId(), vendor, modelCode));
    }

    /** 设为默认模型 */
    @PutMapping("/bindings/{vendor}/{modelCode}/default")
    public BaseResponse<Boolean> setDefault(@PathVariable String vendor, @PathVariable String modelCode) {
        return ResultUtils.success(llmModelService.setDefault(currentUserId(), vendor, modelCode));
    }

    private Long currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return (Long) auth.getPrincipal();
    }
}
