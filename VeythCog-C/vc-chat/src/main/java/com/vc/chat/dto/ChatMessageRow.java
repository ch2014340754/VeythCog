package com.vc.chat.dto;

import lombok.Data;

import java.sql.Timestamp;

/**
 * chat_message 单行查询结果（对话记忆 / 历史回显共用）。
 */
@Data
public class ChatMessageRow {

    private Long id;

    private String role;

    private String content;

    private Timestamp createdAt;
}
