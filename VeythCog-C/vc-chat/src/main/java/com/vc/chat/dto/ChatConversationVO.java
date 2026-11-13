package com.vc.chat.dto;

import lombok.Data;

import java.io.Serializable;
import java.util.List;

/**
 * 会话列表项（由 chat_message 记忆表聚合 + chat_session 会话配置合并得到）。
 * <p>记忆主键为 {@code userId:conversationId}，接口返回时剥离 userId 前缀。</p>
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

    /** 会话绑定的模型 */
    private String vendor;

    private String modelCode;

    /** 会话选中的知识库文档 id 集合 */
    private List<Long> knowledgeDocIds;

    /** 是否开启上下文自动压缩 */
    private Boolean compressEnabled;
}
