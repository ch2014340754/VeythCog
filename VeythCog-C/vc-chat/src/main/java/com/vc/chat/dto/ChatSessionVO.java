package com.vc.chat.dto;

import lombok.Data;

import java.io.Serializable;
import java.util.List;

/**
 * 会话级配置视图。
 */
@Data
public class ChatSessionVO implements Serializable {

    private String conversationId;
    private String title;
    private String vendor;
    private String modelCode;
    private List<Long> docIds;
    private Boolean compressEnabled;
    private Long createdAt;
    private Long updatedAt;
}
