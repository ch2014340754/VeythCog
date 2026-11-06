package com.vc.knowledge.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.io.Serializable;
import java.util.List;

/**
 * RAG 召回请求。
 */
@Data
public class RetrieveRequest implements Serializable {

    /** 选中的文档集合（必须同库，否则拒绝跨库召回） */
    @NotEmpty(message = "docIds 不能为空")
    private List<Long> docIds;

    @NotBlank(message = "query 不能为空")
    private String query;

    /** 召回条数，默认 5 */
    private Integer topN = 5;
}
