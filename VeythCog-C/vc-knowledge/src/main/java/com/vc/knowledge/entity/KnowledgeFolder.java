package com.vc.knowledge.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serializable;
import java.time.OffsetDateTime;

/**
 * 知识库目录实体（MyBatis-Plus，对应 knowledge_folder 表）。
 * <p>自引用树：{@code parentId} 为 null 表示根级；软删除与 {@link KnowledgeDoc} 保持一致。</p>
 */
@Data
@TableName("knowledge_folder")
public class KnowledgeFolder implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 父目录 id；null = 根级 */
    private Long parentId;

    private String name;

    /** 同级排序序号（预留，当前恒为 0） */
    private Integer sortOrder;

    private OffsetDateTime createdAt;

    private OffsetDateTime updatedAt;

    /** 软删除标记（MP 逻辑删除：查询自动过滤 deleted=false） */
    @TableLogic(value = "false", delval = "true")
    private Boolean deleted;
}
