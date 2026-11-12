package com.vc.app.search.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * 搜索页 AI 回答请求。
 */
@Data
public class SearchAiRequest {

    @NotBlank(message = "搜索内容不能为空")
    @Size(max = 200, message = "搜索内容过长")
    private String query;

    /** 是否优先检索当前账号全部已向量化文档 */
    private Boolean knowledgeFirst;
}
