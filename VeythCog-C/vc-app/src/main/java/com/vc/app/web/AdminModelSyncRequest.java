package com.vc.app.web;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * 从供应商同步模型目录请求。
 */
@Data
public class AdminModelSyncRequest {

    @NotBlank(message = "vendor 不能为空")
    private String vendor;

    /** 新增项是否直接上架，默认 false（先由管理员挑选） */
    private Boolean enableNew;
}
