package com.vc.user.todo;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.time.LocalDate;
import java.util.List;

/**
 * 待办数据访问。分页/筛选/排序统一走 XML（多级 CASE WHEN 排序用 Wrapper 拼易错）。
 */
@Mapper
public interface TodoItemMapper extends BaseMapper<TodoItem> {

    /** 分页列表（status=all 表示不过滤；keyword 匹配 title/note；listId 为 null 表示不按列表过滤） */
    List<TodoItem> selectPage(@Param("userId") Long userId,
                              @Param("status") String status,
                              @Param("keyword") String keyword,
                              @Param("listId") Long listId,
                              @Param("limit") int limit,
                              @Param("offset") int offset);

    /** 与 selectPage 同条件的总数 */
    long countByFilter(@Param("userId") Long userId,
                       @Param("status") String status,
                       @Param("keyword") String keyword,
                       @Param("listId") Long listId);

    /** 首页今日视图：未完成前 N 条 */
    List<TodoItem> selectOpenBrief(@Param("userId") Long userId, @Param("limit") int limit);

    /** 未完成总数 */
    long countOpen(@Param("userId") Long userId);

    /** due_date <= today 的未完成数量 */
    long countDueToday(@Param("userId") Long userId, @Param("today") LocalDate today);
}
