package com.vc.user.todo;

import com.vc.common.exception.BusinessException;
import com.vc.common.exception.ErrorCode;
import com.vc.user.todo.dto.TodoListView;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * 待办列表（自定义分组）读写入口。
 *
 * <p>按 userId 过滤；查不到（含不属于当前用户、已软删除）一律 40400，不区分
 * "不存在"与"没权限"。删列表只软删列表本身，其下待办解绑为未归类，不连带删除。</p>
 */
@Service
@RequiredArgsConstructor
public class TodoListService {

    private static final int MAX_NAME_LENGTH = 64;

    private final TodoListMapper listMapper;

    public List<TodoListView> list(Long userId) {
        return listMapper.selectWithCounts(userId);
    }

    @Transactional
    public Long create(Long userId, String name) {
        TodoList row = new TodoList();
        row.setUserId(userId);
        row.setName(normalizeName(name));
        row.setSortOrder(listMapper.maxSortOrder(userId) + 10);
        row.setCreatedAt(OffsetDateTime.now());
        row.setUpdatedAt(OffsetDateTime.now());
        row.setDeleted(false);
        listMapper.insert(row);
        return row.getId();
    }

    @Transactional
    public void rename(Long userId, Long id, String name) {
        TodoList row = require(userId, id);
        row.setName(normalizeName(name));
        row.setUpdatedAt(OffsetDateTime.now());
        listMapper.updateById(row);
    }

    /** 软删除列表；其下待办解绑到 NULL（仍出现在「所有」） */
    @Transactional
    public void delete(Long userId, Long id) {
        TodoList row = require(userId, id);
        row.setDeleted(true);
        row.setUpdatedAt(OffsetDateTime.now());
        listMapper.updateById(row);
        listMapper.clearItemList(userId, id);
    }

    /** 待办挂列表前的归属校验；不合法一律 40400 */
    public TodoList require(Long userId, Long id) {
        if (id == null) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "列表 id 不能为空");
        }
        TodoList row = listMapper.selectById(id);
        if (row == null || Boolean.TRUE.equals(row.getDeleted()) || !userId.equals(row.getUserId())) {
            throw new BusinessException(ErrorCode.NOT_FOUND_ERROR, "列表不存在");
        }
        return row;
    }

    private String normalizeName(String raw) {
        if (raw == null || raw.trim().isEmpty()) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "列表名称不能为空");
        }
        String name = raw.trim();
        if (name.length() > MAX_NAME_LENGTH) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "列表名称不能超过 " + MAX_NAME_LENGTH + " 字");
        }
        return name;
    }
}
