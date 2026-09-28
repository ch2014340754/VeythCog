package com.vc.knowledge.entity;

import lombok.Data;

import java.io.Serializable;

/**
 * 知识库文档（Phase 2 接入解析 / 分块 / Embedding）
 */
@Data
public class Document implements Serializable {

    private Long id;

    private Long knowledgeBaseId;

    private String name;

    /** txt / md / pdf */
    private String type;

    /** pending / processing / done / failed */
    private String status;

    private Integer chunkCount;
}
