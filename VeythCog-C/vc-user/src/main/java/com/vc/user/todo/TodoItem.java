package com.vc.user.todo;

import com.baomidou.mybatisplus.annotation.FieldStrategy;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDate;
import java.time.OffsetDateTime;

/**
 * 个人待办实体（对应 todo_item，用户级、软删除）。
 *
 * <p>状态只有 {@code open/done}；改状态统一走 toggle，PUT 不接受 status。
 * {@code due_date} 只有日期；{@code completed_at} 在 done 时写入、toggle 回 open 时清空。</p>
 */
@Data
@TableName("todo_item")
public class TodoItem implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 所属用户；所有查询按它过滤，不信任前端传参 */
    private Long userId;

    private String title;

    private String note;

    /** open / done */
    private String status;

    /** 0 低 / 1 普通 / 2 高 */
    private Integer priority;

    /** 截止日；null = 无截止日（排序置后） */
    private LocalDate dueDate;

    private String linkUrl;

    /** 关联知识库文档 id；弱引用，不建外键 */
    private Long linkDocId;

    /**
     * 所属列表 id；null = 未归类（只出现在「所有」）。
     * <p>updateStrategy=ALWAYS：解绑列表时要把 null 写回库，默认 NOT_NULL 策略会跳过。</p>
     */
    @TableField(updateStrategy = FieldStrategy.ALWAYS)
    private Long listId;

    /** 预留手动排序，v1 不启用 */
    private Integer sortOrder;

    /**
     * 完成时间；null = 未完成。
     * <p>updateStrategy=ALWAYS：toggle 回 open 时要把 null 写回库，默认 NOT_NULL 策略会跳过。</p>
     */
    @TableField(updateStrategy = FieldStrategy.ALWAYS)
    private OffsetDateTime completedAt;

    private OffsetDateTime createdAt;

    private OffsetDateTime updatedAt;

    private Boolean deleted;
}
