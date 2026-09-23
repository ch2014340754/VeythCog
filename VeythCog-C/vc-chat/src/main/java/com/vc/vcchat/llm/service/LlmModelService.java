package com.vc.vcchat.llm.service;

import com.vc.vcchat.llm.config.LlmVendorProps;
import com.vc.vcchat.llm.dto.CatalogModelItem;
import com.vc.vcchat.llm.dto.CatalogVendorItem;
import com.vc.vcchat.llm.dto.LlmModelItem;
import com.vc.vcchat.llm.entity.LlmModel;
import com.vc.vcchat.llm.entity.UserLlmBinding;
import com.vc.vcchat.llm.enums.LlmVendor;
import com.vc.vcchat.llm.repository.LlmModelRepository;
import com.vc.vcchat.llm.repository.UserLlmBindingRepository;
import com.vc.vccode.exception.BusinessException;
import com.vc.vccode.exception.ErrorCode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * 模型管理服务：绑定查询 / 目录 / 绑定 / 解绑 / 设默认。
 */
@Service
public class LlmModelService {

    private final LlmModelRepository modelRepository;
    private final LlmVendorProps vendorProps;
    private final UserLlmBindingRepository bindingRepository;

    public LlmModelService(LlmModelRepository modelRepository,
                           LlmVendorProps vendorProps,
                           UserLlmBindingRepository bindingRepository) {
        this.modelRepository = modelRepository;
        this.vendorProps = vendorProps;
        this.bindingRepository = bindingRepository;
    }

    /** 当前用户绑定的启用模型（对话页下拉） */
    public List<LlmModelItem> getModels(Long userId) {
        List<LlmModelItem> items = new ArrayList<>();
        for (UserLlmBinding b : bindingRepository.findByUserId(userId)) {
            if (!Boolean.TRUE.equals(b.getEnabled())) {
                continue;
            }
            modelRepository.findByVendorCodeAndModelCode(b.getVendorCode(), b.getModelCode())
                    .filter(m -> Boolean.TRUE.equals(m.getEnabled()))
                    .ifPresent(m -> items.add(new LlmModelItem(
                            m.getVendorCode(), m.getModelCode(), m.getModelName(),
                            true, Boolean.TRUE.equals(b.getIsDefault()))));
        }
        return items;
    }

    /** 供应商枚举 + 模型目录（含当前用户绑定/默认标记） */
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

        List<CatalogVendorItem> result = new ArrayList<>();
        for (LlmVendor v : vendors) {
            String vCode = v.getCode();
            List<CatalogModelItem> models = modelRepository.findByVendorCodeAndEnabledTrue(vCode)
                    .stream()
                    .map(m -> new CatalogModelItem(
                            m.getModelCode(), m.getModelName(),
                            boundKeys.contains(key(vCode, m.getModelCode())),
                            defaultKeys.contains(key(vCode, m.getModelCode())),
                            true))
                    .toList();
            result.add(new CatalogVendorItem(vCode, v.getName(), vendorProps.baseUrl(vCode), models));
        }
        return result;
    }

    /** 绑定模型；重复绑定幂等；isDefault=true 时清其他默认 */
    @Transactional
    public boolean bind(Long userId, String vendor, String modelCode, Boolean isDefault) {
        LlmModel model = modelRepository.findByVendorCodeAndModelCode(vendor, modelCode)
                .orElseThrow(() -> new BusinessException(ErrorCode.PARAMS_ERROR, "模型不存在"));
        if (!Boolean.TRUE.equals(model.getEnabled())) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "模型未启用");
        }
        UserLlmBinding binding = bindingRepository
                .findByUserIdAndVendorCodeAndModelCode(userId, vendor, modelCode)
                .orElseGet(() -> {
                    UserLlmBinding nb = new UserLlmBinding();
                    nb.setUserId(userId);
                    nb.setVendorCode(vendor);
                    nb.setModelCode(modelCode);
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
