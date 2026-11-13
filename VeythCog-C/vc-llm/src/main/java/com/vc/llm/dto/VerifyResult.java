package com.vc.llm.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

/**
 * 模型连通性校验结果。
 */
@Data
@AllArgsConstructor
public class VerifyResult {

    /** 是否通过：通过后该绑定才会出现在对话模型下拉 */
    private Boolean valid;

    /** 面向用户的结论 / 失败原因 */
    private String message;

    /** 探测耗时（毫秒） */
    private Integer latencyMs;

    /** 校验时间（epoch 毫秒） */
    private Long verifiedAt;
}
