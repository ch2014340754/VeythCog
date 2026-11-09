package com.vc.chat.dto;

import lombok.Data;

import java.io.Serializable;

/**
 * 会话历史消息项（来自 chat_message 表）。
 */
@Data
public class ChatMessageVO implements Serializable {

    private Long id;

    /** user / assistant（system 消息不下发前端） */
    private String role;

    private String content;

    private Long createdAt;
}
