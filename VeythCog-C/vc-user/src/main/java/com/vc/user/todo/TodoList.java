package com.vc.user.todo;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serializable;
import java.time.OffsetDateTime;

/**
 * 待办列表（用户自定义分组，对应 todo_list）。
 *
 * <p>软删除；删列表时不去删待办，而是把 {@code todo_item.list_id} 解绑为 NULL，
 * 待办仍留在「所有」分组里。</p>
 */
@Data
@TableName("todo_list")
public class TodoList implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 所属用户；所有查询按它过滤 */
    private Long userId;

    /** 列表名，1~64 字 */
    private String name;

    /** 新建时取同用户最大值 +10，保证排在末尾 */
    private Integer sortOrder;

    private OffsetDateTime createdAt;

    private OffsetDateTime updatedAt;

    private Boolean deleted;
}
