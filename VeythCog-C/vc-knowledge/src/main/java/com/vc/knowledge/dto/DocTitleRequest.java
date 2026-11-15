package com.vc.knowledge.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.io.Serializable;

/**
 * 文档重命名请求：只改标题，不触碰正文与向量化状态。
 */
@Data
public class DocTitleRequest implements Serializable {

    @NotBlank(message = "标题不能为空")
    private String title;
}
