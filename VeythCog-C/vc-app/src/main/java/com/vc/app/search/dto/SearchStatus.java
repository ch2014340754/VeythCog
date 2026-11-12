package com.vc.app.search.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

/**
 * 搜索增强能力状态：知识库开关是否可用、当前默认模型。
 */
@Data
@AllArgsConstructor
public class SearchStatus {

    private boolean knowledgeAvailable;

    private String vendor;

    private String modelCode;

    private String modelName;
}
