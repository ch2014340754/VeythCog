package com.vc.user.todo.dto;

import lombok.Data;

import java.util.List;

/**
 * 待办局部更新请求：字段为 null 表示"不修改"；需要清空的字段放进 {@code clear}。
 *
 * <p>与 {@code UserSettingPatch} 同一约定——JSON 里 null 与缺省无法区分，
 * 因此"清空截止日/链接/备注"一律走 clear 数组，避免歧义。</p>
 *
 * <p>不接受 status：改状态只走 {@code POST /todo/items/{id}/toggle}，保证单一入口。</p>
 */
@Data
public class TodoPatchRequest {

    private String title;

    private String note;

    private Integer priority;

    private String dueDate;

    private String linkUrl;

    private Long linkDocId;

    /** 允许清空的字段：dueDate / linkUrl / linkDocId / note */
    private List<String> clear;
}
