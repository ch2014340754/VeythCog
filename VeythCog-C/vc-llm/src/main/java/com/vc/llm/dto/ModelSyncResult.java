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
    /** 供应商侧返回的模型数量（含文本/多模态/图像/语音等全部类型） */
    private Integer total;
    /** 本次新增条数 */
    private Integer added;
    /** 已有模型被更新（类型/模态/名称修正）的条数 */
    private Integer updated;
    /** 已存在且无需变更的条数 */
    private Integer unchanged;
    /** 兼容旧字段：等于 unchanged */
    private Integer skipped;
    /** 新增的模型编码 */
    private List<String> addedCodes;
    /** 被更新的模型编码 */
    private List<String> updatedCodes;
    private String message;
}
