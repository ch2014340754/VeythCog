package com.vc.music.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vc.common.exception.BusinessException;
import com.vc.common.exception.ErrorCode;
import com.vc.common.s3.S3Bucket;
import com.vc.common.s3.S3ObjectKeyUtils;
import com.vc.common.s3.S3StorageClient;
import com.vc.music.config.MusicProperties;
import com.vc.music.dto.MusicTrackView;
import com.vc.music.dto.PageResult;
import com.vc.music.dto.TrackQuery;
import com.vc.music.dto.TrackUpdateRequest;
import com.vc.music.dto.TrackUploadRequest;
import com.vc.music.entity.MusicTrack;
import com.vc.music.mapper.MusicTrackMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * 曲库服务：上传 / 列表 / 详情 / 元信息更新 / 背景音池 / 软删除。
 *
 * <p><b>账号隔离</b>：所有入口第一个参数都是当前登录用户 id，查询条件强制带 {@code owner_id}，
 * 跨账号访问一律 40400（不暴露对象是否存在）。</p>
 *
 * <p>音频对象存 S3 私有桶 {@code music}，库里只保存对象 key；播放地址由
 * {@link MusicStreamTokenService} 按需签发短时 token，经 {@code /music/stream} 代理下发。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MusicTrackService {

    /** 入库格式白名单（v0.2 评审：只收 mp3 / m4a，wav/flac 不收） */
    private static final Set<String> ALLOWED_EXTENSIONS = Set.of("mp3", "m4a");

    /** 允许的 MIME（浏览器上报五花八门，这里按 `audio/*` + 常见别名收敛） */
    private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of(
            "audio/mpeg", "audio/mp3", "audio/mp4", "audio/x-m4a", "audio/m4a",
            "audio/aac", "audio/x-hx-aac-adts", "application/octet-stream");

    /** 许可枚举：CC-BY-NC 不在其中，入库即被拒 */
    private static final Set<String> ALLOWED_LICENSES = Set.of("CC0", "CC-BY", "OWNED", "AI_GEN", "LICENSED");

    /** 来源枚举 */
    private static final Set<String> ALLOWED_SOURCES = Set.of("UPLOAD", "AI_GEN", "JAMENDO", "AIGEI_CC", "AI_OTHER");

    /** 状态枚举 */
    private static final Set<String> ALLOWED_STATUS = Set.of("published", "hidden");

    /** 封面兜底渐变调色板（与现有 mock / 播放器配色同源） */
    private static final List<String[]> COVER_PALETTE = List.of(
            new String[]{"#7C3AED", "#06B6D4"},
            new String[]{"#059669", "#FBBF24"},
            new String[]{"#4F46E5", "#22D3EE"},
            new String[]{"#E11D48", "#FBBF24"},
            new String[]{"#D97706", "#EF4444"},
            new String[]{"#0EA5E9", "#A78BFA"});

    private final MusicTrackMapper trackMapper;
    private final S3StorageClient storageClient;
    private final MusicStreamTokenService tokenService;
    private final MusicProperties props;
    private final ObjectMapper objectMapper;

    // ================= 列表 / 详情 =================

    /**
     * 分页列表（当前用户作用域）。
     */
    public PageResult<MusicTrackView> page(Long userId, TrackQuery query) {
        TrackQuery q = query == null ? new TrackQuery() : query;
        int current = Math.max(1, q.getCurrent());
        int pageSize = q.getPageSize() <= 0 ? 20 : Math.min(q.getPageSize(), props.getPageSizeMax());
        String keyword = escapeLike(q.getKeyword());

        IPage<MusicTrack> page = trackMapper.selectTrackPage(
                new Page<>(current, pageSize), userId, keyword,
                blankToNull(q.getSource()), q.isAmbientOnly(), blankToNull(q.getTag()),
                q.getSortField(), q.getSortOrder());

        List<MusicTrackView> records = page.getRecords().stream().map(this::toView).toList();
        return new PageResult<>(records, page.getTotal(), page.getCurrent(), page.getSize());
    }

    /**
     * 曲目详情（含播放地址与署名信息）。
     */
    public MusicTrackView detail(Long userId, Long id) {
        return toView(requireTrack(userId, id));
    }

    /**
     * 背景音池：{@code ambient_enabled=true} 且 {@code status=published}，按人工排序升序。
     */
    public List<MusicTrackView> ambient(Long userId) {
        List<MusicTrack> tracks = trackMapper.selectList(
                new LambdaQueryWrapper<MusicTrack>()
                        .eq(MusicTrack::getOwnerId, userId)
                        .eq(MusicTrack::getAmbientEnabled, true)
                        .eq(MusicTrack::getStatus, "published")
                        .orderByAsc(MusicTrack::getAmbientOrder)
                        .orderByAsc(MusicTrack::getId));
        return tracks.stream().map(this::toView).toList();
    }

    // ================= 上传 =================

    /**
     * 上传音频并落库（一次完成「对象上传 + 落库」）。
     *
     * <p>校验顺序：文件大小 → 后缀 → MIME → 文件头魔数 → 时长 → 许可枚举。
     * 落库失败会把已上传的对象删掉，避免孤儿对象。</p>
     */
    public MusicTrackView upload(Long userId, MultipartFile file, TrackUploadRequest req) {
        TrackUploadRequest meta = req == null ? new TrackUploadRequest() : req;
        if (file == null || file.isEmpty()) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "请选择要上传的音频文件");
        }
        if (file.getSize() > props.getMaxFileBytes()) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR,
                    "音频超过 " + (props.getMaxFileBytes() / 1024 / 1024) + "MB 上限");
        }

        String filename = file.getOriginalFilename() == null ? "" : file.getOriginalFilename();
        String extension = S3ObjectKeyUtils.extensionOf(filename);
        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "仅支持 mp3 / m4a 格式");
        }
        String declaredType = file.getContentType();
        if (declaredType != null && !declaredType.isBlank()
                && !ALLOWED_CONTENT_TYPES.contains(normalizeContentType(declaredType))) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "不支持的文件类型：" + declaredType);
        }

        byte[] content;
        try {
            content = file.getBytes();
        } catch (Exception e) {
            throw new BusinessException(ErrorCode.SYSTEM_ERROR, "读取上传文件失败");
        }
        if (!looksLikeAudio(content, extension)) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "文件内容不是有效的 " + extension + " 音频");
        }

        int durationMs = meta.getDurationMs() == null ? 0 : Math.max(0, meta.getDurationMs());
        if (durationMs > props.getMaxDurationMs()) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR,
                    "音频时长超过 " + (props.getMaxDurationMs() / 60000) + " 分钟上限");
        }

        String license = requireLicense(meta.getLicense(), "OWNED");
        String attribution = trimToEmpty(meta.getAttribution());
        if ("CC-BY".equals(license) && attribution.isEmpty()) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "许可为 CC-BY 时必须填写署名");
        }
        boolean aiDisclosure = Boolean.TRUE.equals(meta.getAiDisclosure());
        String aiModel = trimToEmpty(meta.getAiModel());
        if (aiDisclosure && aiModel.isEmpty()) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "勾选 AI 生成时必须填写模型标识");
        }
        String source = normalizeEnum(meta.getSource(), ALLOWED_SOURCES, "UPLOAD", "来源");
        String title = trimToEmpty(meta.getTitle());
        if (title.isEmpty()) {
            title = defaultTitle(filename);
        }
        if (title.length() > 200) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "标题不能超过 200 个字符");
        }

        String contentType = "m4a".equals(extension) ? "audio/mp4" : "audio/mpeg";
        String objectKey = S3ObjectKeyUtils.buildKey("music", "track." + extension);
        try {
            storageClient.upload(S3Bucket.MUSIC, objectKey, content, contentType);
        } catch (Exception e) {
            log.warn("上传音频到 S3 失败 key={}：{}", objectKey, e.getMessage());
            throw new BusinessException(ErrorCode.OPERATION_ERROR, "上传失败，请重试");
        }

        MusicTrack track = new MusicTrack();
        track.setOwnerId(userId);
        track.setTitle(title);
        track.setArtist(trimToEmpty(meta.getArtist()));
        track.setDurationMs(durationMs);
        track.setObjectKey(objectKey);
        track.setCoverColor(coverColorJson(defaultCover(title)));
        track.setSource(source);
        track.setLicense(license);
        track.setAttribution(attribution);
        track.setLicenseUrl(trimToEmpty(meta.getLicenseUrl()));
        track.setAiDisclosure(aiDisclosure);
        track.setAiModel(aiModel);
        track.setTags(toArray(meta.getTags()));
        track.setAmbientEnabled(false);
        track.setAmbientOrder(0);
        track.setStatus("published");
        OffsetDateTime now = OffsetDateTime.now();
        track.setCreatedAt(now);
        track.setUpdatedAt(now);
        track.setDeleted(false);

        try {
            trackMapper.insert(track);
        } catch (Exception e) {
            log.error("曲目落库失败，回滚 S3 对象 key={}：{}", objectKey, e.getMessage());
            safeDeleteObject(objectKey);
            throw new BusinessException(ErrorCode.OPERATION_ERROR, "上传失败，请重试");
        }
        return toView(track);
    }

    // ================= 更新 =================

    /**
     * 更新元信息（只改元信息：标题 / 艺人 / 标签 / 许可 / 署名 / AI 标识 / 来源 / 状态）。
     * {@code null} 字段不改。
     */
    public MusicTrackView update(Long userId, Long id, TrackUpdateRequest req) {
        MusicTrack track = requireTrack(userId, id);
        TrackUpdateRequest r = req == null ? new TrackUpdateRequest() : req;

        if (r.getTitle() != null) {
            String title = r.getTitle().trim();
            if (title.isEmpty()) {
                throw new BusinessException(ErrorCode.PARAMS_ERROR, "标题不能为空");
            }
            if (title.length() > 200) {
                throw new BusinessException(ErrorCode.PARAMS_ERROR, "标题不能超过 200 个字符");
            }
            track.setTitle(title);
        }
        if (r.getArtist() != null) {
            track.setArtist(r.getArtist().trim());
        }
        if (r.getTags() != null) {
            track.setTags(toArray(r.getTags()));
        }
        if (r.getSource() != null) {
            track.setSource(normalizeEnum(r.getSource(), ALLOWED_SOURCES, "UPLOAD", "来源"));
        }
        if (r.getLicense() != null) {
            track.setLicense(requireLicense(r.getLicense(), "OWNED"));
        }
        if (r.getAttribution() != null) {
            track.setAttribution(r.getAttribution().trim());
        }
        if (r.getLicenseUrl() != null) {
            track.setLicenseUrl(r.getLicenseUrl().trim());
        }
        if (r.getAiDisclosure() != null) {
            track.setAiDisclosure(r.getAiDisclosure());
        }
        if (r.getAiModel() != null) {
            track.setAiModel(r.getAiModel().trim());
        }
        if (r.getStatus() != null) {
            track.setStatus(normalizeEnum(r.getStatus(), ALLOWED_STATUS, "published", "状态"));
        }

        // 交叉校验：CC-BY 必须有署名；AI 生成必须有模型标识
        if ("CC-BY".equals(track.getLicense()) && trimToEmpty(track.getAttribution()).isEmpty()) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "许可为 CC-BY 时必须填写署名");
        }
        if (Boolean.TRUE.equals(track.getAiDisclosure()) && trimToEmpty(track.getAiModel()).isEmpty()) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "勾选 AI 生成时必须填写模型标识");
        }
        // 下架的曲目不能留在背景音池里
        if (!"published".equals(track.getStatus()) && Boolean.TRUE.equals(track.getAmbientEnabled())) {
            track.setAmbientEnabled(false);
        }

        track.setUpdatedAt(OffsetDateTime.now());
        trackMapper.updateById(track);
        return toView(track);
    }

    /**
     * 启用 / 停用背景音 + 排序。
     *
     * <p>池上限默认 8 首：加入前先统计当前池内数量，超限直接 40000。
     * 停用不清 {@code ambient_order}，重新加入时可以沿用原位置。</p>
     */
    public MusicTrackView setAmbient(Long userId, Long id, Boolean enabled, Integer order) {
        MusicTrack track = requireTrack(userId, id);
        boolean wantEnable = Boolean.TRUE.equals(enabled);

        if (wantEnable) {
            if (!"published".equals(track.getStatus())) {
                throw new BusinessException(ErrorCode.PARAMS_ERROR, "已下架的曲目不能加入背景音池");
            }
            if (!Boolean.TRUE.equals(track.getAmbientEnabled())) {
                Long count = trackMapper.selectCount(
                        new LambdaQueryWrapper<MusicTrack>()
                                .eq(MusicTrack::getOwnerId, userId)
                                .eq(MusicTrack::getAmbientEnabled, true)
                                .eq(MusicTrack::getStatus, "published"));
                if (count != null && count >= props.getAmbientMax()) {
                    throw new BusinessException(ErrorCode.PARAMS_ERROR,
                            "背景音池最多 " + props.getAmbientMax() + " 首，请先移除其他曲目");
                }
            }
            track.setAmbientEnabled(true);
            if (order != null) {
                track.setAmbientOrder(order);
            } else if (track.getAmbientOrder() == null || track.getAmbientOrder() == 0) {
                track.setAmbientOrder(nextAmbientOrder(userId));
            }
        } else {
            track.setAmbientEnabled(false);
            if (order != null) {
                track.setAmbientOrder(order);
            }
        }
        track.setUpdatedAt(OffsetDateTime.now());
        trackMapper.updateById(track);
        return toView(track);
    }

    // ================= 删除 =================

    /**
     * 软删除 + 删除 S3 对象（幂等）。
     * <p>对象删除失败只记日志：库内已经不可见，对象后续可运维清理，不让用户卡在删除失败上。</p>
     */
    @Transactional
    public void delete(Long userId, Long id) {
        MusicTrack track = requireTrack(userId, id);
        trackMapper.deleteById(track.getId());
        safeDeleteObject(track.getObjectKey());
    }

    // ================= 内部工具 =================

    private MusicTrack requireTrack(Long userId, Long id) {
        if (id == null) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "曲目 id 不能为空");
        }
        MusicTrack track = trackMapper.selectById(id);
        if (track == null || track.getOwnerId() == null || !track.getOwnerId().equals(userId)) {
            throw new BusinessException(ErrorCode.NOT_FOUND_ERROR, "曲目不存在或无权限");
        }
        return track;
    }

    /**
     * 按播流签名生成下发结构。
     * <p>{@code streamUrl} 是接口相对路径（{@code /music/stream/{id}?token=...}），
     * 由前端用 {@code apiUrl()} 拼上后端基址后交给 {@code <audio>}。</p>
     */
    public MusicTrackView toView(MusicTrack track) {
        MusicTrackView view = new MusicTrackView();
        view.setId(track.getId());
        view.setTitle(track.getTitle());
        view.setArtist(track.getArtist() == null ? "" : track.getArtist());
        view.setDurationMs(track.getDurationMs() == null ? 0 : track.getDurationMs());
        view.setCoverColor(parseCoverColor(track.getCoverColor(), track.getTitle()));
        view.setSource(track.getSource());
        view.setLicense(track.getLicense());
        view.setAttribution(track.getAttribution() == null ? "" : track.getAttribution());
        view.setLicenseUrl(track.getLicenseUrl() == null ? "" : track.getLicenseUrl());
        view.setAiDisclosure(Boolean.TRUE.equals(track.getAiDisclosure()));
        view.setAiModel(track.getAiModel() == null ? "" : track.getAiModel());
        view.setTags(track.getTags() == null ? List.of() : Arrays.asList(track.getTags()));
        view.setAmbientEnabled(Boolean.TRUE.equals(track.getAmbientEnabled()));
        view.setAmbientOrder(track.getAmbientOrder() == null ? 0 : track.getAmbientOrder());
        view.setStatus(track.getStatus());
        view.setCreatedAt(epochMillis(track.getCreatedAt()));
        view.setUpdatedAt(epochMillis(track.getUpdatedAt()));
        String token = tokenService.issue(track.getOwnerId(), track.getId());
        view.setStreamUrl("/music/stream/" + track.getId() + "?token=" + token);
        return view;
    }

    private int nextAmbientOrder(Long userId) {
        MusicTrack last = trackMapper.selectOne(
                new LambdaQueryWrapper<MusicTrack>()
                        .eq(MusicTrack::getOwnerId, userId)
                        .eq(MusicTrack::getAmbientEnabled, true)
                        .orderByDesc(MusicTrack::getAmbientOrder)
                        .last("LIMIT 1"));
        return last == null || last.getAmbientOrder() == null ? 10 : last.getAmbientOrder() + 10;
    }

    private void safeDeleteObject(String objectKey) {
        if (objectKey == null || objectKey.isBlank()) {
            return;
        }
        try {
            storageClient.delete(S3Bucket.MUSIC, objectKey);
        } catch (Exception e) {
            log.warn("删除 S3 音频对象失败 key={}：{}", objectKey, e.getMessage());
        }
    }

    private String requireLicense(String license, String fallback) {
        String value = trimToEmpty(license);
        if (value.isEmpty()) {
            return fallback;
        }
        String upper = value.toUpperCase(Locale.ROOT);
        if ("CC-BY-NC".equals(upper) || upper.startsWith("CC-BY-NC")) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "CC-BY-NC 许可的曲目不允许入库");
        }
        if (!ALLOWED_LICENSES.contains(upper)) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "不支持的许可类型：" + license);
        }
        return upper;
    }

    private String normalizeEnum(String value, Set<String> allowed, String fallback, String label) {
        String trimmed = trimToEmpty(value);
        if (trimmed.isEmpty()) {
            return fallback;
        }
        // 大小写不敏感比对，返回白名单里的规范写法（来源/许可大写，状态小写，不能统一转大写）
        for (String candidate : allowed) {
            if (candidate.equalsIgnoreCase(trimmed)) {
                return candidate;
            }
        }
        throw new BusinessException(ErrorCode.PARAMS_ERROR, "不支持的" + label + "：" + value);
    }

    /** ILIKE 通配符转义：用户输入里的 % / _ 不能被当成通配符 */
    private static String escapeLike(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        return raw.trim()
                .replace("\\", "\\\\")
                .replace("%", "\\%")
                .replace("_", "\\_");
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static String trimToEmpty(String value) {
        return value == null ? "" : value.trim();
    }

    private static String normalizeContentType(String contentType) {
        String value = contentType.trim();
        int semicolon = value.indexOf(';');
        if (semicolon >= 0) {
            value = value.substring(0, semicolon);
        }
        return value.trim().toLowerCase(Locale.ROOT);
    }

    /** 文件头魔数校验：mp3（ID3 或 0xFFEx 帧同步）/ m4a（第 4~7 字节 ftyp） */
    private static boolean looksLikeAudio(byte[] content, String extension) {
        if (content == null || content.length < 8) {
            return false;
        }
        if ("m4a".equals(extension)) {
            return content[4] == 'f' && content[5] == 't' && content[6] == 'y' && content[7] == 'p';
        }
        if (content[0] == 'I' && content[1] == 'D' && content[2] == '3') {
            return true;
        }
        return (content[0] & 0xFF) == 0xFF && (content[1] & 0xE0) == 0xE0;
    }

    private static String defaultTitle(String filename) {
        String name = filename == null ? "" : filename.trim();
        int slash = Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\'));
        if (slash >= 0) {
            name = name.substring(slash + 1);
        }
        int dot = name.lastIndexOf('.');
        if (dot > 0) {
            name = name.substring(0, dot);
        }
        String title = name.trim();
        if (title.isEmpty()) {
            return "未命名曲目";
        }
        return title.length() > 200 ? title.substring(0, 200) : title;
    }

    /** 按标题 hash 固定选一组渐变：同一首歌每次刷新颜色都一致 */
    private static String[] defaultCover(String title) {
        int hash = title == null ? 0 : title.hashCode();
        return COVER_PALETTE.get(Math.floorMod(hash, COVER_PALETTE.size()));
    }

    private String coverColorJson(String[] colors) {
        try {
            return objectMapper.writeValueAsString(List.of(colors[0], colors[1]));
        } catch (Exception e) {
            return "[]";
        }
    }

    private List<String> parseCoverColor(String json, String title) {
        if (json != null && !json.isBlank()) {
            try {
                List<String> colors = objectMapper.readValue(json, new TypeReference<List<String>>() { });
                if (colors != null && colors.size() >= 2) {
                    return colors;
                }
            } catch (Exception e) {
                log.debug("解析 cover_color 失败，按标题兜底：{}", e.getMessage());
            }
        }
        return List.of(defaultCover(title));
    }

    private static String[] toArray(List<String> values) {
        if (values == null) {
            return new String[0];
        }
        List<String> cleaned = new ArrayList<>(values.size());
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                cleaned.add(value.trim());
            }
        }
        return cleaned.toArray(new String[0]);
    }

    private static long epochMillis(OffsetDateTime time) {
        return time == null ? 0L : time.toInstant().toEpochMilli();
    }

    /** 供流代理校验归属（不抛异常，返回 null 表示不存在/无权限） */
    public MusicTrack findForStream(Long userId, Long trackId) {
        MusicTrack track = trackMapper.selectById(trackId);
        if (track == null || !userId.equals(track.getOwnerId())) {
            return null;
        }
        return track;
    }
}
