package com.vc.knowledge.clip.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.io.Serializable;

/**
 * 站内"粘贴链接"剪藏请求（{@code POST /clip/url}）。
 */
@Data
public class ClipUrlRequest implements Serializable {

    @NotBlank(message = "url 不能为空")
    private String url;
}
