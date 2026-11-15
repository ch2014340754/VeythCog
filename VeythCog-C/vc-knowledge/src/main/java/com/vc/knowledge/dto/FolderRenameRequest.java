package com.vc.knowledge.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.io.Serializable;

/**
 * 目录重命名请求。
 */
@Data
public class FolderRenameRequest implements Serializable {

    @NotBlank(message = "目录名不能为空")
    private String name;
}
