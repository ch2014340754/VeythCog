package com.vc.app.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vc.common.BaseResponse;
import com.vc.common.ResultUtils;
import com.vc.common.exception.BusinessException;
import com.vc.common.exception.ErrorCode;
import com.vc.knowledge.clip.dto.ClipCaptureRequest;
import com.vc.knowledge.clip.dto.ClipImportResult;
import com.vc.knowledge.clip.dto.ClipItemDetail;
import com.vc.knowledge.clip.dto.ClipItemView;
import com.vc.knowledge.clip.dto.ClipToKnowledgeRequest;
import com.vc.knowledge.clip.dto.ClipTokenCreateRequest;
import com.vc.knowledge.clip.dto.ClipTokenCreateResult;
import com.vc.knowledge.clip.dto.ClipTokenView;
import com.vc.knowledge.clip.dto.ClipUpdateRequest;
import com.vc.knowledge.clip.dto.ClipUrlRequest;
import com.vc.knowledge.clip.service.ClipService;
import com.vc.knowledge.clip.service.ClipTokenService;
import com.vc.knowledge.dto.PageResult;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
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

import java.util.List;

/**
 * 网页剪藏 + 收件箱接口。
 *
 * <ul>
 *   <li>{@code POST /clip/capture} —— 唯一 permitAll 的写入口，靠 query 里的剪藏令牌鉴权（书签脚本/扩展用）</li>
 *   <li>其余接口都要 JWT，且以当前登录用户为作用域</li>
 * </ul>
 */
@RestController
@RequestMapping("/clip")
public class ClipController {

    private static final Logger log = LoggerFactory.getLogger(ClipController.class);

    private final ClipService clipService;
    private final ClipTokenService tokenService;
    private final ObjectMapper objectMapper;

    public ClipController(ClipService clipService, ClipTokenService tokenService, ObjectMapper objectMapper) {
        this.clipService = clipService;
        this.tokenService = tokenService;
        this.objectMapper = objectMapper;
    }

    // ------------------------------------------------------------------ 剪藏写入

    /** 站内粘贴链接：服务端抓取 + 清洗 + 落库（抓取失败也留一条带 error 的记录） */
    @PostMapping("/url")
    public BaseResponse<ClipItemView> clipUrl(@Valid @RequestBody ClipUrlRequest request) {
        return ResultUtils.success(clipService.clipByUrl(currentUserId(), request.getUrl()));
    }

    /**
     * 书签脚本 / 扩展上报。
     *
     * <p>body 用 {@code text/plain} 承载 JSON —— 这是 CORS「简单请求」，不会触发预检，
     * 脚本才能在最少的代码里跨域写入。</p>
     */
    @PostMapping(value = "/capture", consumes = MediaType.TEXT_PLAIN_VALUE)
    public BaseResponse<ClipItemView> capture(@RequestParam(name = "token", required = false) String token,
                                              @RequestBody(required = false) String body) {
        Long ownerId = tokenService.authenticate(token);
        if (body == null || body.isBlank()) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "上报内容为空");
        }
        ClipCaptureRequest request;
        try {
            request = objectMapper.readValue(body, ClipCaptureRequest.class);
        } catch (Exception e) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "上报内容不是合法 JSON");
        }
        log.info("书签剪藏上报: ownerId={}, url={}, htmlLen={}", ownerId,
                request.getUrl(), request.getHtml() == null ? 0 : request.getHtml().length());
        return ResultUtils.success(clipService.capture(ownerId, request));
    }

    // ------------------------------------------------------------------ 收件箱

    @GetMapping("/items")
    public BaseResponse<PageResult<ClipItemView>> list(
            @RequestParam(name = "status", required = false) String status,
            @RequestParam(name = "keyword", required = false) String keyword,
            @RequestParam(name = "current", defaultValue = "1") int current,
            @RequestParam(name = "pageSize", defaultValue = "20") int pageSize) {
        return ResultUtils.success(clipService.list(currentUserId(), status, keyword, current, pageSize));
    }

    /** 侧栏角标：待处理条数 */
    @GetMapping("/pending-count")
    public BaseResponse<Long> pendingCount() {
        return ResultUtils.success(clipService.pendingCount(currentUserId()));
    }

    @GetMapping("/items/{id}")
    public BaseResponse<ClipItemDetail> detail(@PathVariable("id") Long id) {
        return ResultUtils.success(clipService.detail(currentUserId(), id));
    }

    @PutMapping("/items/{id}")
    public BaseResponse<ClipItemView> update(@PathVariable("id") Long id,
                                             @RequestBody ClipUpdateRequest request) {
        return ResultUtils.success(clipService.update(currentUserId(), id, request));
    }

    /** 入库：建知识文档 + 默认向量化；已入库过则直接返回原 docId */
    @PostMapping("/items/{id}/to-knowledge")
    public BaseResponse<ClipImportResult> toKnowledge(@PathVariable("id") Long id,
                                                      @RequestBody(required = false) ClipToKnowledgeRequest request) {
        return ResultUtils.success(clipService.toKnowledge(currentUserId(), id, request));
    }

    @DeleteMapping("/items/{id}")
    public BaseResponse<Void> delete(@PathVariable("id") Long id) {
        clipService.delete(currentUserId(), id);
        return ResultUtils.success(null);
    }

    // ------------------------------------------------------------------ 令牌

    /** 新建令牌：明文与书签脚本只在本次响应里出现，前端必须提示用户立刻复制/拖拽 */
    @PostMapping("/tokens")
    public BaseResponse<ClipTokenCreateResult> createToken(@RequestBody(required = false) ClipTokenCreateRequest request) {
        ClipTokenCreateRequest safe = request == null ? new ClipTokenCreateRequest() : request;
        return ResultUtils.success(tokenService.create(currentUserId(), safe.getLabel(), safe.getApiBase()));
    }

    @GetMapping("/tokens")
    public BaseResponse<List<ClipTokenView>> tokens() {
        return ResultUtils.success(tokenService.list(currentUserId()));
    }

    @DeleteMapping("/tokens/{id}")
    public BaseResponse<Void> revokeToken(@PathVariable("id") Long id) {
        tokenService.revoke(currentUserId(), id);
        return ResultUtils.success(null);
    }

    // ------------------------------------------------------------------ 内部

    private Long currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof Long)) {
            throw new BusinessException(ErrorCode.NOT_LOGIN_ERROR, "未登录");
        }
        return (Long) auth.getPrincipal();
    }
}
