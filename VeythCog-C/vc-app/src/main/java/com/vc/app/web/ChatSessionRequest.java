package com.vc.app.web;

import lombok.Data;

import java.util.List;

/**
 * 会话配置写入请求（新建 / 局部更新共用；字段为 null 表示不修改）。
 */
@Data
public class ChatSessionRequest {

    private String conversationId;
    private String title;
    private String vendor;
    private String modelCode;
    private List<Long> docIds;
    private Boolean compressEnabled;
}
