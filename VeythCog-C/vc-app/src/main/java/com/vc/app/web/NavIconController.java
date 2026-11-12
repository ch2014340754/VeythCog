package com.vc.app.web;

import com.vc.common.BaseResponse;
import com.vc.common.ResultUtils;
import com.vc.common.exception.BusinessException;
import com.vc.common.exception.ErrorCode;
import com.vc.nav.dto.IconFetchRequest;
import com.vc.nav.dto.IconSyncResult;
import com.vc.nav.dto.IconUploadResult;
import com.vc.nav.service.NavIconService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

/**
 * 导航书签图标接口：从网址获取 / 上传自定义 / 同步缺失。
 */
@RestController
@RequestMapping("/nav/icons")
@RequiredArgsConstructor
public class NavIconController {

    /** 手动同步单次上限，避免一次请求抓太多站点 */
    private static final int SYNC_LIMIT = 200;

    private final NavIconService iconService;

    /** 从网址抓取站点图标并上传 S3（弹窗「获取图标」） */
    @PostMapping("/fetch")
    public BaseResponse<IconUploadResult> fetch(@Valid @RequestBody IconFetchRequest req) {
        return ResultUtils.success(iconService.fetchFromSite(req.getUrl()));
    }

    /** 上传自定义图标（png/jpg/webp/gif/ico，≤512KB） */
    @PostMapping("/upload")
    public BaseResponse<IconUploadResult> upload(@RequestParam("file") MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "请选择图标文件");
        }
        try {
            return ResultUtils.success(iconService.uploadCustom(
                    file.getBytes(), file.getOriginalFilename(), file.getContentType()));
        } catch (IOException e) {
            throw new BusinessException(ErrorCode.OPERATION_ERROR, "读取上传文件失败");
        }
    }

    /** 补齐当前用户缺失的站点图标 */
    @PostMapping("/sync")
    public BaseResponse<IconSyncResult> sync() {
        return ResultUtils.success(iconService.syncMissing(currentUserId(), SYNC_LIMIT));
    }

    private Long currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof Long userId)) {
            throw new BusinessException(ErrorCode.NOT_LOGIN_ERROR, "未登录");
        }
        return userId;
    }
}
