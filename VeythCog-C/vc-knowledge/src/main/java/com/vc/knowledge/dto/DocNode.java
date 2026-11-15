package com.vc.knowledge.dto;

import lombok.Data;

import java.io.Serializable;
import java.util.List;

/**
 * 文档节点（树查询返回的轻量文档项，不含正文）。
 */
@Data
public class DocNode implements Serializable {

    private Long id;

    /** 所属目录 id；null = 根级（含「原目录已被删除」的兜底情况） */
    private Long folderId;

    private String title;

    private String summary;

    private List<String> tags;

    private Boolean isVectorized;

    /** epoch 毫秒 */
    private Long updatedAt;
}
