package com.vc.user.todo.dto;

import lombok.Data;

import java.io.Serializable;
import java.util.List;

/**
 * 待办分页结构；字段与前端 {@code PageResult<T>} 保持一致（records/total/current/pageSize）。
 */
@Data
public class TodoPage implements Serializable {

    private List<TodoItemView> records;

    private long total;

    private int current;

    private int pageSize;

    public TodoPage(List<TodoItemView> records, long total, int current, int pageSize) {
        this.records = records;
        this.total = total;
        this.current = current;
        this.pageSize = pageSize;
    }
}
