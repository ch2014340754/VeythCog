package com.vc.user.todo;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.vc.user.todo.dto.TodoListView;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 待办列表数据访问。
 *
 * <p>带计数的查询走 XML（LEFT JOIN + FILTER 聚合，用 Wrapper 拼不出来）。</p>
 */
@Mapper
public interface TodoListMapper extends BaseMapper<TodoList> {

    /** 当前用户的列表 + 各自未完成/已完成条数（按 sort_order 升序） */
    List<TodoListView> selectWithCounts(@Param("userId") Long userId);

    /** 同用户最大值，用于给新列表排序号（无列表时返回 0） */
    int maxSortOrder(@Param("userId") Long userId);

    /** 删列表时解绑其下待办：list_id 置 NULL（待办保留） */
    int clearItemList(@Param("userId") Long userId, @Param("listId") Long listId);
}
