package com.vc.nav.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

/**
 * 批量排序请求项。
 */
@Data
public class ReorderItem {

    @NotNull(message = "ID 不能为空")
    private Long id;

    @NotNull(message = "排序值不能为空")
    private Integer sortOrder;
}
