package com.vc.app.web;

import com.vc.common.BaseResponse;
import com.vc.common.ResultUtils;
import com.vc.llm.dto.AdminModelItem;
import com.vc.llm.dto.ModelSyncResult;
import com.vc.llm.enums.LlmVendor;
import com.vc.llm.service.LlmCatalogAdminService;
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

import java.util.Arrays;
import java.util.List;
import java.util.Map;

/**
 * 系统管理 · 模型目录维护（仅 admin 角色，路径由 SecurityConfig 统一约束）。
 */
@RestController
@RequestMapping("/admin/llm-models")
public class AdminLlmModelController {

    private final LlmCatalogAdminService catalogAdminService;

    public AdminLlmModelController(LlmCatalogAdminService catalogAdminService) {
        this.catalogAdminService = catalogAdminService;
    }

    /** 全部模型（含未上架） */
    @GetMapping
    public BaseResponse<List<AdminModelItem>> list() {
        return ResultUtils.success(catalogAdminService.list());
    }

    /** 供应商选项（固定枚举） */
    @GetMapping("/vendors")
    public BaseResponse<List<Map<String, String>>> vendors() {
        return ResultUtils.success(Arrays.stream(LlmVendor.values())
                .map(v -> Map.of("vendor", v.getCode(), "vendorName", v.getName()))
                .toList());
    }

    /** 新增模型 */
    @PostMapping
    public BaseResponse<AdminModelItem> create(@Valid @RequestBody AdminModelSaveRequest request) {
        return ResultUtils.success(catalogAdminService.create(
                request.getVendor(), request.getModelCode(), request.getModelName(),
                request.getMaxContextTokens(), request.getTemperature(), request.getEnabled()));
    }

    /** 编辑模型（已绑定的模型不允许改供应商/编码） */
    @PutMapping("/{id}")
    public BaseResponse<AdminModelItem> update(@PathVariable Long id,
                                              @Valid @RequestBody AdminModelSaveRequest request) {
        return ResultUtils.success(catalogAdminService.update(
                id, request.getVendor(), request.getModelCode(), request.getModelName(),
                request.getMaxContextTokens(), request.getTemperature(), request.getEnabled()));
    }

    /** 删除模型（仍有用户绑定时拒绝） */
    @DeleteMapping("/{id}")
    public BaseResponse<Boolean> delete(@PathVariable Long id) {
        return ResultUtils.success(catalogAdminService.delete(id));
    }

    /** 上架 / 下架 */
    @PutMapping("/{id}/enabled")
    public BaseResponse<AdminModelItem> setEnabled(@PathVariable Long id,
                                                  @Valid @RequestBody AdminModelEnabledRequest request) {
        return ResultUtils.success(catalogAdminService.setEnabled(id, request.getEnabled()));
    }

    /** 从供应商同步模型（只增不删；新增默认不上架） */
    @PostMapping("/sync")
    public BaseResponse<ModelSyncResult> sync(@Valid @RequestBody AdminModelSyncRequest request) {
        boolean enableNew = Boolean.TRUE.equals(request.getEnableNew());
        return ResultUtils.success(catalogAdminService.sync(
                request.getVendor(), currentUserId(), enableNew));
    }

    private Long currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return (Long) auth.getPrincipal();
    }
}
