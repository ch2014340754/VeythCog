package com.vc.knowledge.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.vc.knowledge.handler.VectorTypeHandler;
import lombok.Data;

import java.io.Serializable;
import java.time.OffsetDateTime;

/**
 * 文档向量分片表实体（MyBatis-Plus，对应 knowledge_embedding 表）。
 */
@Data
@TableName("knowledge_embedding")
public class KnowledgeEmbedding implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long docId;

    /** 文档内分片序号（从 0 起） */
    private Integer chunkIndex;

    private String chunkText;

    /** 向量（pgvector vector(1024)），用 VectorTypeHandler 映射 float[] */
    @TableField(typeHandler = VectorTypeHandler.class)
    private float[] embedding;

    /** 生成该向量的 embedding 模型标识，用于禁止不同模型向量混查 */
    private String embeddingModel;

    private OffsetDateTime createdAt;
}
