package com.vc.chat.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 会话级配置：模型绑定 / RAG 文档集合 / 上下文自动压缩开关。
 * <p>与 {@code chat_message} 通过 {@code conversationId} 关联（消息表保持原结构不动）。</p>
 */
@Data
@Entity
@Table(name = "chat_session")
public class ChatSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "conversation_id", nullable = false, length = 64)
    private String conversationId;

    @Column(name = "session_title", length = 255)
    private String title;

    @Column(name = "vendor_code", length = 32)
    private String vendorCode;

    @Column(name = "model_code", length = 64)
    private String modelCode;

    /** 逗号分隔的知识库文档 id，例如 "12,34"；空串表示不启用 RAG */
    @Column(name = "rag_doc_ids", nullable = false, columnDefinition = "text")
    private String ragDocIds = "";

    @Column(name = "enable_context_compress", nullable = false)
    private Boolean compressEnabled = true;

    @Column(name = "deleted", nullable = false)
    private Boolean deleted = false;

    @Column(name = "create_time", nullable = false)
    private LocalDateTime createTime;

    @Column(name = "update_time", nullable = false)
    private LocalDateTime updateTime;

    @PrePersist
    public void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        if (createTime == null) {
            createTime = now;
        }
        updateTime = now;
        if (ragDocIds == null) {
            ragDocIds = "";
        }
        if (compressEnabled == null) {
            compressEnabled = true;
        }
        if (deleted == null) {
            deleted = false;
        }
    }

    @PreUpdate
    public void onUpdate() {
        updateTime = LocalDateTime.now();
    }
}
