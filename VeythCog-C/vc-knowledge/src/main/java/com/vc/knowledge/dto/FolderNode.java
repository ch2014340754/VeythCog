package com.vc.knowledge.dto;

import lombok.Data;

import java.io.Serializable;

/**
 * 目录节点（树查询返回的扁平目录项，由前端组装层级）。
 */
@Data
public class FolderNode implements Serializable {

    private Long id;

    /** 父目录 id；null = 根级（含「父目录已被删除」的兜底情况） */
    private Long parentId;

    private String name;

    private Integer sortOrder;
}
