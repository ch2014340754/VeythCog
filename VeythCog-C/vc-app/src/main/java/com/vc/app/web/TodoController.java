package com.vc.app.web;

import com.vc.common.BaseResponse;
import com.vc.common.ResultUtils;
import com.vc.common.exception.BusinessException;
import com.vc.common.exception.ErrorCode;
import com.vc.user.todo.TodoService;
import com.vc.user.todo.dto.TodoCreateRequest;
import com.vc.user.todo.dto.TodoItemView;
import com.vc.user.todo.dto.TodoPage;
import com.vc.user.todo.dto.TodoPatchRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 个人待办接口（todo_item）。
 *
 * <p>所有接口按 JWT 中的 userId 过滤；不接受前端传 user_id。</p>
 */
@RestController
@RequestMapping("/todo/items")
@RequiredArgsConstructor
public class TodoController {

    private final TodoService todoService;

    /** 分页列表：status=all/open/done，keyword 匹配标题与备注，listId 限定某个列表 */
    @GetMapping
    public BaseResponse<TodoPage> list(@RequestParam(required = false) String status,
                                       @RequestParam(required = false) String keyword,
                                       @RequestParam(required = false) Long listId,
                                       @RequestParam(defaultValue = "1") int current,
                                       @RequestParam(defaultValue = "20") int pageSize) {
        return ResultUtils.success(
                todoService.list(currentUserId(), status, keyword, listId, current, pageSize));
    }

    /** 未完成待办简报（工作台 / 角标用，最多 limit 条，按优先级与截止日排序） */
    @GetMapping("/open")
    public BaseResponse<java.util.List<TodoItemView>> open(@RequestParam(defaultValue = "5") int limit) {
        return ResultUtils.success(todoService.openBrief(currentUserId(), Math.min(limit, 50)));
    }

    /** 新建 */
    @PostMapping
    public BaseResponse<Long> create(@Valid @RequestBody TodoCreateRequest req) {
        return ResultUtils.success(todoService.create(currentUserId(), req));
    }

    /** 局部更新（不接受 status） */
    @PutMapping("/{id}")
    public BaseResponse<Void> update(@PathVariable Long id, @RequestBody TodoPatchRequest req) {
        todoService.update(currentUserId(), id, req);
        return ResultUtils.success(null);
    }

    /** 切换完成状态，返回切换后的完整行 */
    @PostMapping("/{id}/toggle")
    public BaseResponse<TodoItemView> toggle(@PathVariable Long id) {
        return ResultUtils.success(todoService.toggle(currentUserId(), id));
    }

    /** 软删除 */
    @DeleteMapping("/{id}")
    public BaseResponse<Void> delete(@PathVariable Long id) {
        todoService.delete(currentUserId(), id);
        return ResultUtils.success(null);
    }

    private Long currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof Long userId)) {
            throw new BusinessException(ErrorCode.NOT_LOGIN_ERROR, "未登录");
        }
        return userId;
    }
}
