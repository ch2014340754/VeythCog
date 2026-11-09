package com.vc.chat.dto;

import lombok.Data;

import java.io.Serializable;

/**
 * 会话列表项（由 chat_message 记忆表聚合得到）。
 * <p>后端目前没有独立会话表：会话即"同一 conversation_id 下的消息集合"，
 * 记忆主键为 {@code userId:conversationId}，接口返回时剥离 userId 前缀。</p>
 */
@Data
public class ChatConversationVO implements Serializable {

    /** 会话 id（前端生成，已剥离 userId 前缀） */
    private String id;

    /** 标题：取该会话第一条用户消息（截断） */
    private String title;

    /** 最后一条消息（截断） */
    private String lastMessage;

    /** 消息条数 */
    private Integer messageCount;

    private Long createdAt;

    private Long updatedAt;
}
