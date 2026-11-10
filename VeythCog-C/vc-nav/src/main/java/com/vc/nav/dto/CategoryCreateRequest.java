package com.vc.nav.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * 新建分类请求。
 */
@Data
public class CategoryCreateRequest {

    @NotBlank(message = "分类名不能为空")
    @Size(max = 32, message = "分类名最长 32 字")
    private String name;

    /** 分类图标（emoji，如 🏠 </>），可空 */
    @Size(max = 128, message = "图标最长 128 字符")
    private String icon;
}
