package com.vc.knowledge.dto;

import lombok.Data;

import java.io.Serializable;

/**
 * RAG 召回片段。
 */
@Data
public class RetrieveChunk implements Serializable {

    private String chunkText;

    private Long docId;

    private String title;

    /** 文档内分片序号（从 0 起），用于引用溯源 */
    private Integer chunkIndex;

    /** L2 距离，越小越相似 */
    private Double score;
}
