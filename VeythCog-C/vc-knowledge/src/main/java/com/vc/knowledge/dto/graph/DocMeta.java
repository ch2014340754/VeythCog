package com.vc.knowledge.dto.graph;

import lombok.Data;

import java.time.OffsetDateTime;

/**
 * 文档轻量元信息（构图的输入之一，不含正文与 block_data）。
 */
@Data
public class DocMeta {

    private Long id;

    private String title;

    private Long folderId;

    /** 共同标签计算用 */
    private String[] tags;

    /** markdown_text 字符数 */
    private int charCount;

    private OffsetDateTime updatedAt;
}
