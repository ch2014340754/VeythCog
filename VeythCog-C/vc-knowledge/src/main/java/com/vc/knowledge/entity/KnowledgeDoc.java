package com.vc.knowledge.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import com.vc.knowledge.handler.JsonbTypeHandler;
import com.vc.knowledge.handler.StringArrayTypeHandler;
import lombok.Data;

import java.io.Serializable;
import java.time.OffsetDateTime;

/**
 * 知识库文档主表实体（MyBatis-Plus，对应 knowledge_doc 表）。
 */
@Data
@TableName("knowledge_doc")
public class KnowledgeDoc implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String title;

    private String summary;

    /** 标签数组（PostgreSQL text[]），用 StringArrayTypeHandler 映射 */
    @TableField(typeHandler = StringArrayTypeHandler.class)
    private String[] tags;

    /** 块结构数组 JSON（权威源），jsonb 列用 JsonbTypeHandler 显式映射 */
    @TableField(typeHandler = JsonbTypeHandler.class)
    private String blockData;

    /** 标准 Markdown（派生缓存，供检索/导出/RAG 切片） */
    private String markdownText;

    private Boolean isVectorized;

    private OffsetDateTime createdAt;

    private OffsetDateTime updatedAt;

    /** 软删除标记（MP 逻辑删除：查询自动过滤 deleted=false，删除改为置 true） */
    @TableLogic(value = "false", delval = "true")
    private Boolean deleted;
}
