package com.vc.vcchat.chat;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.io.Serializable;

/**
 * 对话请求：统一入口，携带 vendor + modelCode 用于路由。
 */
@Data
public class ChatRequest implements Serializable {

    @NotBlank(message = "消息不能为空")
    private String message;

    @NotBlank(message = "vendor 不能为空")
    private String vendor;

    @NotBlank(message = "modelCode 不能为空")
    private String modelCode;
}
