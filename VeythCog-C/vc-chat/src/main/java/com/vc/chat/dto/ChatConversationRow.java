package com.vc.chat.dto;

import lombok.Data;

import java.sql.Timestamp;

/**
 * 会话聚合查询行（chat_message 按 conversation_id 聚合）。
 * <p>仅承载 SQL 结果，展示层的截断 / 前缀剥离在 {@code ChatHistoryService} 处理。</p>
 */
@Data
public class ChatConversationRow {

    /** 记忆主键：{@code userId:conversationId} */
    private String conversationId;

    private Integer messageCount;

    /** 该会话第一条用户消息（原文，未剥离 RAG 上下文） */
    private String firstUser;

    /** 该会话最后一条消息（原文） */
    private String lastContent;

    private Timestamp createdAt;

    private Timestamp updatedAt;
}
