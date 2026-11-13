package com.vc.app.web;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.io.Serializable;

/**
 * 编辑用户 AK 请求。
 */
@Data
public class ApiKeyRequest implements Serializable {

    @NotBlank(message = "API Key 不能为空")
    private String apiKey;
}
