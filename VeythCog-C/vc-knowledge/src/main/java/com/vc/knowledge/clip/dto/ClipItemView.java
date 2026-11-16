package com.vc.knowledge.clip.dto;

import lombok.Data;

import java.io.Serializable;
import java.util.List;

/**
 * 收件箱列表项（不含正文，避免列表接口带大字段）。
 */
@Data
public class ClipItemView implements Serializable {

    private Long id;

    private String url;

    private String site;

    private String title;

    private String byline;

    private String excerpt;

    private Integer wordCount;

    private String quality;

    private String channel;

    private String status;

    private String error;

    private List<String> tags;

    /** 已入库时指向 knowledge_doc */
    private Long docId;

    /** epoch 毫秒 */
    private Long createdAt;

    private Long updatedAt;
}
