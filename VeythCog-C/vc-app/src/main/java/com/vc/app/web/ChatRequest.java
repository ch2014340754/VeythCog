package com.vc.app.web;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.io.Serializable;
import java.util.List;

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

    /** 会话 id：用于会话隔离与记忆（可为空，后端会叠加 userId 生成隔离主键） */
    private String conversationId;

    /**
     * 本次对话绑定的知识库文档 id 集合（可选）。
     * <p>非空时后端负责检索、拼上下文并随 SSE 下发引用；为空则按普通对话处理。</p>
     */
    private List<Long> docIds;

    /** 是否开启上下文自动压缩；为空时按会话配置（默认开启） */
    private Boolean compressEnabled;
}
