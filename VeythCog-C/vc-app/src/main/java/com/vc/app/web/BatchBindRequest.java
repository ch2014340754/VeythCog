package com.vc.app.web;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.io.Serializable;
import java.util.List;

/**
 * 批量绑定请求：供应商 → 多选模型 + 可选新 AK + 可选默认模型。
 * <p>{@code modelCodes} 为空数组表示解绑该供应商下全部模型；
 * {@code apiKey} 留空表示不修改现有用户 AK。</p>
 */
@Data
public class BatchBindRequest implements Serializable {

    @NotBlank(message = "vendor 不能为空")
    private String vendor;

    @NotNull(message = "modelCodes 不能为 null")
    private List<String> modelCodes;

    /** 新 AK（可选）；留空保留原值，清除请走 DELETE /llm/vendors/{vendor}/api-key */
    private String apiKey;

    /** 默认模型（可选，必须来自 modelCodes） */
    private String defaultModelCode;
}
