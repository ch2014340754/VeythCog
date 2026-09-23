package com.vc.vcchat.llm.controller;

import com.vc.vcchat.llm.dto.BindRequest;
import com.vc.vcchat.llm.dto.CatalogVendorItem;
import com.vc.vcchat.llm.dto.LlmModelItem;
import com.vc.vcchat.llm.service.LlmModelService;
import com.vc.vccode.common.BaseResponse;
import com.vc.vccode.common.ResultUtils;
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

    public LlmModelController(LlmModelService llmModelService) {
        this.llmModelService = llmModelService;
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
