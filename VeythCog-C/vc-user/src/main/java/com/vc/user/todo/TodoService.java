package com.vc.user.todo;

import com.vc.common.exception.BusinessException;
import com.vc.common.exception.ErrorCode;
import com.vc.user.todo.dto.TodoCreateRequest;
import com.vc.user.todo.dto.TodoItemView;
import com.vc.user.todo.dto.TodoPage;
import com.vc.user.todo.dto.TodoPatchRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * 个人待办读写入口。
 *
 * <p>所有方法按 userId 过滤；查不到（含不属于当前用户、已软删除）一律抛 40400，
 * 不区分"不存在"与"没权限"，避免泄露存在性。</p>
 */
@Service
@RequiredArgsConstructor
public class TodoService {

    private static final String STATUS_OPEN = "open";
    private static final String STATUS_DONE = "done";

    /** status 白名单 */
    private static final Set<String> STATUSES = Set.of(STATUS_OPEN, STATUS_DONE);

    /** 允许 clear 显式置空的字段白名单 */
    private static final Set<String> CLEARABLE_FIELDS = Set.of("dueDate", "linkUrl", "linkDocId", "note", "listId");

    private static final int DEFAULT_PAGE_SIZE = 20;
    private static final int MAX_PAGE_SIZE = 100;

    private final TodoItemMapper todoMapper;

    private final TodoListService todoListService;

    /**
     * 新建待办：默认 open、priority=1、无截止日。
     */
    @Transactional
    public Long create(Long userId, TodoCreateRequest req) {
        if (req == null) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "请求体不能为空");
        }
        String title = normalizeTitle(req.getTitle());
        Integer priority = normalizePriority(req.getPriority());
        LocalDate dueDate = parseDate(req.getDueDate());
        Long listId = null;
        if (req.getListId() != null) {
            // 挂列表前先校验归属，避免前端串用别人的列表 id
            todoListService.require(userId, req.getListId());
            listId = req.getListId();
        }

        TodoItem item = new TodoItem();
        item.setUserId(userId);
        item.setTitle(title);
        item.setNote(emptyIfNull(req.getNote()));
        item.setStatus(STATUS_OPEN);
        item.setPriority(priority);
        item.setDueDate(dueDate);
        item.setLinkUrl(trimToNull(req.getLinkUrl()));
        item.setLinkDocId(req.getLinkDocId());
        item.setListId(listId);
        item.setSortOrder(0);
        item.setCompletedAt(null);
        item.setCreatedAt(OffsetDateTime.now());
        item.setUpdatedAt(OffsetDateTime.now());
        item.setDeleted(false);
        todoMapper.insert(item);
        return item.getId();
    }

    /**
     * 分页列表；status 缺省 all，listId 为 null 表示不按列表过滤，pageSize 超过 100 按 100 处理。
     */
    public TodoPage list(Long userId, String status, String keyword, Long listId, int current, int pageSize) {
        String normalizedStatus = normalizeStatusFilter(status);
        String normalizedKeyword = keyword == null ? "" : keyword.trim();
        int page = Math.max(1, current);
        int size = pageSize <= 0 ? DEFAULT_PAGE_SIZE : Math.min(pageSize, MAX_PAGE_SIZE);
        int offset = (page - 1) * size;

        long total = todoMapper.countByFilter(userId, normalizedStatus, normalizedKeyword, listId);
        List<TodoItem> rows = todoMapper.selectPage(userId, normalizedStatus, normalizedKeyword, listId, size, offset);
        List<TodoItemView> views = new ArrayList<>(rows.size());
        for (TodoItem row : rows) {
            views.add(toView(row));
        }
        return new TodoPage(views, total, page, size);
    }

    /**
     * 局部更新：null 字段不改，clear 中的字段置空；不接受 status。
     */
    @Transactional
    public void update(Long userId, Long id, TodoPatchRequest req) {
        TodoItem item = require(userId, id);
        if (req == null) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "请求体不能为空");
        }
        Set<String> clear = normalizeClear(req.getClear());

        if (req.getTitle() != null) {
            item.setTitle(normalizeTitle(req.getTitle()));
        }
        if (req.getNote() != null) {
            item.setNote(req.getNote());
        }
        if (clear.contains("note")) {
            item.setNote("");
        }
        if (req.getPriority() != null) {
            item.setPriority(normalizePriority(req.getPriority()));
        }
        if (req.getDueDate() != null) {
            item.setDueDate(parseDate(req.getDueDate()));
        }
        if (clear.contains("dueDate")) {
            item.setDueDate(null);
        }
        if (req.getLinkUrl() != null) {
            item.setLinkUrl(trimToNull(req.getLinkUrl()));
        }
        if (clear.contains("linkUrl")) {
            item.setLinkUrl(null);
        }
        if (req.getLinkDocId() != null) {
            item.setLinkDocId(req.getLinkDocId());
        }
        if (clear.contains("linkDocId")) {
            item.setLinkDocId(null);
        }
        if (req.getListId() != null) {
            todoListService.require(userId, req.getListId());
            item.setListId(req.getListId());
        }
        if (clear.contains("listId")) {
            item.setListId(null);
        }

        item.setUpdatedAt(OffsetDateTime.now());
        todoMapper.updateById(item);
    }

    /**
     * 切换完成：open→done 写 completed_at，done→open 清空；返回切换后的完整视图。
     */
    @Transactional
    public TodoItemView toggle(Long userId, Long id) {
        TodoItem item = require(userId, id);
        OffsetDateTime now = OffsetDateTime.now();
        if (STATUS_OPEN.equals(item.getStatus())) {
            item.setStatus(STATUS_DONE);
            item.setCompletedAt(now);
        } else {
            item.setStatus(STATUS_OPEN);
            item.setCompletedAt(null);
        }
        item.setUpdatedAt(now);
        todoMapper.updateById(item);
        return toView(item);
    }

    /**
     * 软删除；行保留，deleted=true。
     */
    @Transactional
    public void delete(Long userId, Long id) {
        TodoItem item = require(userId, id);
        item.setDeleted(true);
        item.setUpdatedAt(OffsetDateTime.now());
        todoMapper.updateById(item);
    }

    /**
     * 首页今日视图：未完成前 N 条。
     */
    public List<TodoItemView> openBrief(Long userId, int limit) {
        List<TodoItem> rows = todoMapper.selectOpenBrief(userId, Math.max(1, limit));
        List<TodoItemView> views = new ArrayList<>(rows.size());
        for (TodoItem row : rows) {
            views.add(toView(row));
        }
        return views;
    }

    public long countOpen(Long userId) {
        return todoMapper.countOpen(userId);
    }

    public long countDueToday(Long userId) {
        return todoMapper.countDueToday(userId, LocalDate.now());
    }

    /** 查不到 / 不属于当前用户 / 已删除 → 40400 */
    private TodoItem require(Long userId, Long id) {
        if (id == null) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "待办 id 不能为空");
        }
        TodoItem item = todoMapper.selectById(id);
        if (item == null || Boolean.TRUE.equals(item.getDeleted()) || !userId.equals(item.getUserId())) {
            throw new BusinessException(ErrorCode.NOT_FOUND_ERROR, "待办不存在");
        }
        return item;
    }

    private TodoItemView toView(TodoItem item) {
        TodoItemView view = new TodoItemView();
        view.setId(item.getId());
        view.setTitle(item.getTitle());
        view.setNote(item.getNote());
        view.setStatus(item.getStatus());
        view.setPriority(item.getPriority());
        view.setDueDate(item.getDueDate() == null ? null : item.getDueDate().toString());
        view.setOverdue(item.getDueDate() != null
                && STATUS_OPEN.equals(item.getStatus())
                && item.getDueDate().isBefore(LocalDate.now()));
        view.setLinkUrl(item.getLinkUrl());
        view.setLinkDocId(item.getLinkDocId());
        view.setListId(item.getListId());
        view.setCreatedAt(toEpochMilli(item.getCreatedAt()));
        view.setUpdatedAt(toEpochMilli(item.getUpdatedAt()));
        view.setCompletedAt(toEpochMilli(item.getCompletedAt()));
        return view;
    }

    private Long toEpochMilli(OffsetDateTime time) {
        return time == null ? null : time.toInstant().toEpochMilli();
    }

    private String normalizeTitle(String raw) {
        if (raw == null || raw.trim().isEmpty()) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "待办标题不能为空");
        }
        String title = raw.trim();
        if (title.length() > 255) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "待办标题不能超过 255 字");
        }
        return title;
    }

    private Integer normalizePriority(Integer priority) {
        if (priority == null) {
            return 1;
        }
        if (priority < 0 || priority > 2) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "优先级只能是 0 / 1 / 2");
        }
        return priority;
    }

    private LocalDate parseDate(String raw) {
        if (raw == null || raw.trim().isEmpty()) {
            return null;
        }
        try {
            return LocalDate.parse(raw.trim());
        } catch (DateTimeParseException e) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "截止日格式应为 yyyy-MM-dd");
        }
    }

    private String normalizeStatusFilter(String status) {
        if (status == null || status.trim().isEmpty()) {
            return "all";
        }
        String normalized = status.trim().toLowerCase(Locale.ROOT);
        if (!"all".equals(normalized) && !STATUSES.contains(normalized)) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "状态只能是 all / open / done");
        }
        return normalized;
    }

    private Set<String> normalizeClear(List<String> clear) {
        if (clear == null || clear.isEmpty()) {
            return Set.of();
        }
        Set<String> normalized = new LinkedHashSet<>();
        for (String field : clear) {
            if (field == null || field.isBlank()) {
                continue;
            }
            String name = field.trim();
            if (!CLEARABLE_FIELDS.contains(name)) {
                throw new BusinessException(ErrorCode.PARAMS_ERROR, "不支持清空的字段：" + name);
            }
            normalized.add(name);
        }
        return normalized;
    }

    private String emptyIfNull(String v) {
        return v == null ? "" : v;
    }

    private String trimToNull(String v) {
        if (v == null) {
            return null;
        }
        String trimmed = v.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
