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

    @NotBlank(message = "title 不能为空")
    private String title;

    private String summary = "";

    /** 所属目录 id（新建时生效；更新走 /doc/{id}/move，本字段在更新时忽略）；null = 根级 */
    private Long folderId;

    private List<String> tags = new ArrayList<>();

    /** 块结构 JSON（权威源） */
    private String blockData = "[]";

    /** 标准 Markdown（派生缓存） */
    private String markdownText = "";
}
