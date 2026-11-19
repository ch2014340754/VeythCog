package com.vc.app.web;

import com.vc.app.workbench.WorkbenchService;
import com.vc.app.workbench.dto.WorkbenchOverview;
import com.vc.common.BaseResponse;
import com.vc.common.ResultUtils;
import com.vc.common.exception.BusinessException;
import com.vc.common.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 工作台聚合接口。
 */
@RestController
@RequestMapping("/workbench")
@RequiredArgsConstructor
public class WorkbenchController {

    private final WorkbenchService workbenchService;

    /**
     * 首页「今日」视图一次性取数。无参数；失败块降级但 HTTP 仍 200。
     */
    @GetMapping("/overview")
    public BaseResponse<WorkbenchOverview> overview() {
        return ResultUtils.success(workbenchService.overview(currentUserId()));
    }

    private Long currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof Long userId)) {
            throw new BusinessException(ErrorCode.NOT_LOGIN_ERROR, "未登录");
        }
        return userId;
    }
}
