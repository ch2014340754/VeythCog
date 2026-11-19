package com.vc.user.todo.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * 列表名称请求（新建与重命名共用）。
 */
@Data
public class TodoListNameRequest {

    @NotBlank(message = "列表名称不能为空")
    @Size(max = 64, message = "列表名称不能超过 64 字")
    private String name;
}
