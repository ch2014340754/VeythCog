package com.vc.user.todo.dto;

import lombok.Data;

/**
 * 待办列表视图（含计数）。
 */
@Data
public class TodoListView {

    private Long id;

    private String name;

    private Integer sortOrder;

    /** 该列表下未完成条数 */
    private Long openCount;

    /** 该列表下已完成条数 */
    private Long doneCount;
}
