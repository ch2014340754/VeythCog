package com.vc.nav.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * 从网址获取图标请求。
 */
@Data
public class IconFetchRequest {

    @NotBlank(message = "网址不能为空")
    @Size(max = 512, message = "网址最长 512 字符")
    private String url;
}
