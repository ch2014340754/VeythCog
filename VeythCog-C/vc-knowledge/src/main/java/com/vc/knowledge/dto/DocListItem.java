package com.vc.knowledge.dto;

import lombok.Data;

import java.io.Serializable;
import java.util.List;

/**
 * 文档列表项。
 */
@Data
public class DocListItem implements Serializable {

    private Long id;

    private String title;

    private String summary;

    /** 所属目录 id；null = 根级 */
    private Long folderId;

    private List<String> tags;

    private Boolean isVectorized;

    /** epoch 毫秒 */
    private Long updatedAt;
}
