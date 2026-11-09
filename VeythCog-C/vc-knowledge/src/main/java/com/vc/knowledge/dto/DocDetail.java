package com.vc.knowledge.dto;

import lombok.Data;

import java.io.Serializable;
import java.util.List;

/**
 * 文档详情。
 */
@Data
public class DocDetail implements Serializable {

    private Long id;

    private String title;

    private String summary;

    private List<String> tags;

    private String blockData;

    private String markdownText;

    private Boolean isVectorized;

    /** epoch 毫秒 */
    private Long createdAt;

    /** epoch 毫秒 */
    private Long updatedAt;
}
