package com.vc.knowledge.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

/**
 * 新建 / 更新文档请求体（二者字段一致）。
 */
@Data
public class DocSaveRequest implements Serializable {

    /** private / demo */
    @NotBlank(message = "libType 不能为空")
    private String libType;

    @NotBlank(message = "title 不能为空")
    private String title;

    private String summary = "";

    private List<String> tags = new ArrayList<>();

    /** 块结构 JSON（权威源） */
    private String blockData = "[]";

    /** 标准 Markdown（派生缓存） */
    private String markdownText = "";
}
