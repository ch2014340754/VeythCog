package com.vc.user.todo.dto;

import lombok.Data;

/**
 * 待办视图（接口下发）。时间统一 epoch millis，日期为 yyyy-MM-dd。
 */
@Data
public class TodoItemView {

    private Long id;

    private String title;

    private String note;

    /** open / done */
    private String status;

    /** 0 低 / 1 普通 / 2 高 */
    private Integer priority;

    /** yyyy-MM-dd；null = 无截止日 */
    private String dueDate;

    /** 计算字段：dueDate < 今天且未完成 */
    private Boolean overdue;

    private String linkUrl;

    private Long linkDocId;

    private Long createdAt;

    private Long updatedAt;

    /** null = 未完成 */
    private Long completedAt;
}
