package com.vc.knowledge.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.io.Serializable;

/**
 * 新建目录请求：parentId 为空表示根级。
 */
@Data
public class FolderCreateRequest implements Serializable {

    private Long parentId;

    @NotBlank(message = "目录名不能为空")
    private String name;
}
