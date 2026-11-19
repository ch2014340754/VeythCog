package com.vc.app.web;

import com.vc.common.BaseResponse;
import com.vc.common.ResultUtils;
import com.vc.common.exception.BusinessException;
import com.vc.common.exception.ErrorCode;
import com.vc.user.todo.TodoListService;
import com.vc.user.todo.dto.TodoListNameRequest;
import com.vc.user.todo.dto.TodoListView;
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
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 待办列表（自定义分组）接口。
 *
 * <p>与 TodoController 一致，全部按 JWT 中的 userId 过滤，不接受前端传 user_id。
 * 删列表不删待办：其下待办解绑为未归类，仍出现在「所有」。</p>
 */
@RestController
@RequestMapping("/todo/lists")
@RequiredArgsConstructor
public class TodoListController {

    private final TodoListService todoListService;

    /** 列表清单（带未完成/已完成计数） */
    @GetMapping
    public BaseResponse<List<TodoListView>> list() {
        return ResultUtils.success(todoListService.list(currentUserId()));
    }

    /** 新建列表 */
    @PostMapping
    public BaseResponse<Long> create(@Valid @RequestBody TodoListNameRequest req) {
        return ResultUtils.success(todoListService.create(currentUserId(), req.getName()));
    }

    /** 重命名 */
    @PutMapping("/{id}")
    public BaseResponse<Void> rename(@PathVariable Long id, @Valid @RequestBody TodoListNameRequest req) {
        todoListService.rename(currentUserId(), id, req.getName());
        return ResultUtils.success(null);
    }

    /** 软删除列表（连同其下待办解绑） */
    @DeleteMapping("/{id}")
    public BaseResponse<Void> delete(@PathVariable Long id) {
        todoListService.delete(currentUserId(), id);
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
