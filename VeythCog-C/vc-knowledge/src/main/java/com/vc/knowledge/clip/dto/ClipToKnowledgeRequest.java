package com.vc.knowledge.clip.dto;

import lombok.Data;

import java.io.Serializable;
import java.util.List;

/**
 * 收件箱条目 → 知识库文档。
 */
@Data
public class ClipToKnowledgeRequest implements Serializable {

    /** 目标目录；null = 根级 */
    private Long folderId;

    /** 覆盖标签（为空则沿用条目自带标签） */
    private List<String> tags;

    /** 覆盖标题（为空则沿用条目标题） */
    private String title;

    /** 是否立即向量化，默认 true */
    private Boolean vectorize;
}
