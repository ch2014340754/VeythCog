package com.vc.app.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vc.common.BaseResponse;
import com.vc.common.ResultUtils;
import com.vc.common.exception.BusinessException;
import com.vc.common.exception.ErrorCode;
import com.vc.music.dto.AmbientUpdateRequest;
import com.vc.music.dto.MusicTrackView;
import com.vc.music.dto.PageResult;
import com.vc.music.dto.TrackQuery;
import com.vc.music.dto.TrackUpdateRequest;
import com.vc.music.dto.TrackUploadRequest;
import com.vc.music.entity.MusicTrack;
import com.vc.music.service.MusicStreamService;
import com.vc.music.service.MusicStreamTokenService;
import com.vc.music.service.MusicTrackService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.time.Duration;
import java.util.List;

/**
 * 音乐库接口（前缀 {@code /api/music}）。
 *
 * <p>除播流接口外，全部以当前登录用户为作用域（{@code owner_id}），跨账号访问统一 40400。
 * 播流接口由 {@code <audio src>} 直连、带不上 Authorization，因此走 query 短时签名，
 * 并在 {@code SecurityConfig} 中放行（签名本身承担鉴权）。</p>
 */
@Slf4j
@RestController
@RequestMapping("/music")
@RequiredArgsConstructor
public class MusicController {

    private final MusicTrackService trackService;
    private final MusicStreamService streamService;
    private final MusicStreamTokenService tokenService;
    private final ObjectMapper objectMapper;

    /** 1. 分页列表（keyword / source / ambientOnly / tag） */
    @GetMapping("/tracks")
    public BaseResponse<PageResult<MusicTrackView>> list(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String source,
            @RequestParam(required = false, defaultValue = "false") boolean ambientOnly,
            @RequestParam(required = false) String tag,
            @RequestParam(defaultValue = "1") int current,
            @RequestParam(defaultValue = "20") int pageSize,
            @RequestParam(required = false) String sortField,
            @RequestParam(required = false, defaultValue = "descend") String sortOrder) {
        TrackQuery query = new TrackQuery();
        query.setKeyword(keyword);
        query.setSource(source);
        query.setAmbientOnly(ambientOnly);
        query.setTag(tag);
        query.setCurrent(current);
        query.setPageSize(pageSize);
        query.setSortField(sortField);
        query.setSortOrder(sortOrder);
        return ResultUtils.success(trackService.page(currentUserId(), query));
    }

    /** 2. 详情（含播放地址与署名信息） */
    @GetMapping("/tracks/{id}")
    public BaseResponse<MusicTrackView> detail(@PathVariable Long id) {
        return ResultUtils.success(trackService.detail(currentUserId(), id));
    }

    /**
     * 3. 上传音频 + 元信息（multipart）。
     * <p>{@code meta} 部分是 JSON 字符串（TrackUploadRequest），与文件一次提交完成「对象上传 + 落库」。</p>
     */
    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public BaseResponse<MusicTrackView> upload(
            @RequestPart("file") MultipartFile file,
            @RequestParam(value = "meta", required = false) String meta) {
        TrackUploadRequest request = parseMeta(meta);
        return ResultUtils.success(trackService.upload(currentUserId(), file, request));
    }

    /** 4. 更新元信息（null 字段不改） */
    @PutMapping("/tracks/{id}")
    public BaseResponse<MusicTrackView> update(@PathVariable Long id, @RequestBody TrackUpdateRequest req) {
        return ResultUtils.success(trackService.update(currentUserId(), id, req));
    }

    /** 5. 启用 / 停用背景音 + 排序 */
    @PutMapping("/tracks/{id}/ambient")
    public BaseResponse<MusicTrackView> ambient(@PathVariable Long id, @RequestBody AmbientUpdateRequest req) {
        AmbientUpdateRequest body = req == null ? new AmbientUpdateRequest() : req;
        return ResultUtils.success(trackService.setAmbient(currentUserId(), id, body.getEnabled(), body.getOrder()));
    }

    /** 6. 删除（软删除 + 删 S3 对象，幂等） */
    @DeleteMapping("/tracks/{id}")
    public BaseResponse<Void> delete(@PathVariable Long id) {
        trackService.delete(currentUserId(), id);
        return ResultUtils.success(null);
    }

    /** 7. 背景音池（按 ambient_order 升序） */
    @GetMapping("/ambient")
    public BaseResponse<List<MusicTrackView>> ambientList() {
        return ResultUtils.success(trackService.ambient(currentUserId()));
    }

    /**
     * 8. 音频流代理（Range / 206）。
     *
     * <p>鉴权靠 query 短时 token（绑定用户 + 曲目 + 过期时间），接口本身在 SecurityConfig 放行。
     * token 过期时返回 401 业务码，前端捕获 audio error 后静默刷新列表换新 token 续播。</p>
     */
    @GetMapping("/stream/{id}")
    public ResponseEntity<StreamingResponseBody> stream(
            @PathVariable Long id,
            @RequestParam(value = "token", required = false) String token,
            @RequestHeader(value = HttpHeaders.RANGE, required = false) String range) {
        MusicStreamTokenService.StreamIdentity identity = tokenService.verify(token, id);
        MusicTrack track = trackService.findForStream(identity.userId(), id);
        if (track == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND_ERROR, "曲目不存在或无权限");
        }
        MusicStreamService.AudioStream audio = streamService.stream(track.getObjectKey(), range);
        StreamingResponseBody body = outputStream -> {
            try (var in = audio.stream()) {
                in.transferTo(outputStream);
            }
        };
        ResponseEntity.BodyBuilder builder = ResponseEntity
                .status(audio.partial() ? 206 : 200)
                .contentType(MediaType.parseMediaType(audio.contentType()))
                .contentLength(audio.length())
                .header("Accept-Ranges", "bytes")
                // 私有缓存 5 分钟：同一 token 有效期内浏览器可复用，不落共享缓存
                .cacheControl(CacheControl.maxAge(Duration.ofMinutes(5)).cachePrivate());
        if (audio.partial()) {
            builder.header("Content-Range", "bytes " + audio.start() + "-" + audio.end() + "/" + audio.totalLength());
        }
        return builder.body(body);
    }

    private TrackUploadRequest parseMeta(String meta) {
        if (meta == null || meta.isBlank()) {
            return new TrackUploadRequest();
        }
        try {
            return objectMapper.readValue(meta, TrackUploadRequest.class);
        } catch (Exception e) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "上传元信息格式非法");
        }
    }

    private Long currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof Long userId)) {
            throw new BusinessException(ErrorCode.NOT_LOGIN_ERROR, "未登录");
        }
        return userId;
    }
}
