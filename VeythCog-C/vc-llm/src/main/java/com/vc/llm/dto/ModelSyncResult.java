package com.vc.llm.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;

/**
 * 供应商模型同步结果。
 */
@Data
@AllArgsConstructor
public class ModelSyncResult {

    private String vendor;
    private String vendorName;
    /** 供应商侧返回的数量（已过滤非对话模型） */
    private Integer total;
    /** 本次新增条数 */
    private Integer added;
    /** 已存在而跳过条数 */
    private Integer skipped;
    /** 新增的模型编码 */
    private List<String> addedCodes;
    private String message;
}
