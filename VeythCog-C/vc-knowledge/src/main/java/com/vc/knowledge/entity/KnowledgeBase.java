package com.vc.knowledge.entity;

import lombok.Data;

import java.io.Serializable;

/**
 * 知识库（RAG 检索单元）
 */
@Data
public class KnowledgeBase implements Serializable {

    private Long id;

    private String name;

    private String description;

    private Integer docCount;
}
