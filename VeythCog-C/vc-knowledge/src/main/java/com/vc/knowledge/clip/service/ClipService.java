package com.vc.knowledge.clip.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.vc.common.exception.BusinessException;
import com.vc.common.exception.ErrorCode;
import com.vc.knowledge.clip.config.ClipProperties;
import com.vc.knowledge.clip.dto.ClipCaptureRequest;
import com.vc.knowledge.clip.dto.ClipImportResult;
import com.vc.knowledge.clip.dto.ClipItemDetail;
import com.vc.knowledge.clip.dto.ClipItemView;
import com.vc.knowledge.clip.dto.ClipToKnowledgeRequest;
import com.vc.knowledge.clip.dto.ClipUpdateRequest;
import com.vc.knowledge.clip.entity.ClipItem;
import com.vc.knowledge.clip.mapper.ClipItemMapper;
import com.vc.knowledge.dto.DocSaveRequest;
import com.vc.knowledge.dto.PageResult;
import com.vc.knowledge.service.KnowledgeService;
import com.vc.knowledge.service.VectorizeService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;

/**
 * 收件箱服务：剪藏落库、列表、预览、编辑、入库、删除。
 *
 * <p>设计要点：剪藏只是"把内容捞进待处理队列"，入库（建知识文档 + 向量化）
 * 是用户显式动作，两者分开，避免抓取噪声直接污染 RAG 检索。</p>
 */
@Service
public class ClipService {

    private static final Logger log = LoggerFactory.getLogger(ClipService.class);

    private static final String STATUS_PENDING = "pending";
    private static final String STATUS_ARCHIVED = "archived";
    private static final String STATUS_DROPPED = "dropped";

    private final ClipItemMapper itemMapper;
    private final ClipFetchService fetchService;
    private final ClipProperties properties;
    private final KnowledgeService knowledgeService;
    private final VectorizeService vectorizeService;

    public ClipService(ClipItemMapper itemMapper,
                       ClipFetchService fetchService,
                       ClipProperties properties,
                       KnowledgeService knowledgeService,
                       VectorizeService vectorizeService) {
        this.itemMapper = itemMapper;
        this.fetchService = fetchService;
        this.properties = properties;
        this.knowledgeService = knowledgeService;
        this.vectorizeService = vectorizeService;
    }

    // ------------------------------------------------------------------ 写入

    /**
     * 站内"粘贴链接"剪藏：服务端抓取 + 清洗 + 落库。
     * <p>抓取失败也落一条带 {@code error} 的记录（保留 URL 便于重试），不向前端抛错。</p>
     */
    @Transactional
    public ClipItemView clipByUrl(Long userId, String url) {
        String trimmed = url == null ? "" : url.trim();
        if (trimmed.isEmpty()) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "url 不能为空");
        }
        ClipItem existing = findSameUrl(userId, trimmed);
        if (existing != null) {
            return toView(existing, true);
        }
        assertQuota(userId);

        ClipFetchService.Fetched fetched;
        String error = "";
        try {
            fetched = fetchService.fetch(trimmed);
        } catch (BusinessException e) {
            if (e.getCode() == ErrorCode.PARAMS_ERROR.getCode()) {
                // 参数/安全校验失败是"用户输入问题"，不该落库成一条垃圾记录
                throw e;
            }
            error = e.getMessage();
            fetched = new ClipFetchService.Fetched(titleFromUrl(trimmed), "", siteOf(trimmed),
                    "", null, "", 0, "fallback", error);
        }

        ClipItem item = new ClipItem();
        item.setOwnerId(userId);
        item.setUrl(trimmed);
        item.setSite(fetched.site());
        item.setTitle(fetched.title());
        item.setByline(fetched.byline());
        item.setExcerpt(fetched.excerpt());
        item.setContentMd(fetched.markdown());
        item.setRawHtml(fetched.rawHtml());
        item.setWordCount(fetched.wordCount());
        item.setQuality(fetched.quality());
        item.setChannel("url");
        item.setStatus(STATUS_PENDING);
        item.setError(error);
        item.setTags(new String[0]);
        item.setCreatedAt(OffsetDateTime.now());
        item.setUpdatedAt(OffsetDateTime.now());
        itemMapper.insert(item);
        log.info("剪藏落库: userId={}, id={}, site={}, words={}, quality={}, error={}",
                userId, item.getId(), item.getSite(), item.getWordCount(), item.getQuality(), error);
        return toView(item, false);
    }

    /**
     * 书签脚本 / 扩展上报：不发外网请求，直接用页面 DOM 清洗。
     */
    @Transactional
    public ClipItemView capture(Long userId, ClipCaptureRequest request) {
        String url = request.getUrl() == null ? "" : request.getUrl().trim();
        if (url.isEmpty() && request.getHtml() == null && request.getExcerpt() == null) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "上报内容为空");
        }
        if (!url.isEmpty()) {
            ClipItem existing = findSameUrl(userId, url);
            if (existing != null) {
                return toView(existing, true);
            }
        }
        assertQuota(userId);

        ClipFetchService.Fetched fetched = fetchService.fromHtml(
                url, request.getHtml(), request.getTitle(), request.getExcerpt());

        ClipItem item = new ClipItem();
        item.setOwnerId(userId);
        item.setUrl(url);
        item.setSite(fetched.site());
        item.setTitle(fetched.title());
        item.setByline(fetched.byline());
        item.setExcerpt(fetched.excerpt());
        item.setContentMd(fetched.markdown());
        item.setRawHtml(fetched.rawHtml());
        item.setWordCount(fetched.wordCount());
        item.setQuality(fetched.quality());
        item.setChannel("bookmarklet");
        item.setStatus(STATUS_PENDING);
        item.setError(fetched.error());
        item.setTags(new String[0]);
        item.setCreatedAt(OffsetDateTime.now());
        item.setUpdatedAt(OffsetDateTime.now());
        itemMapper.insert(item);
        log.info("书签剪藏落库: userId={}, id={}, site={}, words={}", userId, item.getId(), item.getSite(),
                item.getWordCount());
        return toView(item, false);
    }

    // ------------------------------------------------------------------ 查询

    public PageResult<ClipItemView> list(Long userId, String status, String keyword, int current, int pageSize) {
        int safeCurrent = Math.max(1, current);
        int safeSize = Math.min(Math.max(1, pageSize), 100);

        LambdaQueryWrapper<ClipItem> wrapper = new LambdaQueryWrapper<ClipItem>()
                .eq(ClipItem::getOwnerId, userId);
        if (status != null && !status.isBlank() && !"all".equalsIgnoreCase(status)) {
            wrapper.eq(ClipItem::getStatus, status.toLowerCase(Locale.ROOT));
        }
        if (keyword != null && !keyword.isBlank()) {
            String kw = keyword.trim();
            wrapper.and(w -> w.like(ClipItem::getTitle, kw).or().like(ClipItem::getSite, kw));
        }
        wrapper.orderByDesc(ClipItem::getCreatedAt);

        IPage<ClipItem> page = itemMapper.selectPage(new Page<>(safeCurrent, safeSize), wrapper);
        List<ClipItemView> views = new ArrayList<>(page.getRecords().size());
        for (ClipItem item : page.getRecords()) {
            views.add(toView(item, false));
        }
        return new PageResult<>(views, page.getTotal(), safeCurrent, safeSize);
    }

    public ClipItemDetail detail(Long userId, Long id) {
        ClipItem item = requireItem(userId, id);
        ClipItemDetail detail = new ClipItemDetail();
        fillView(detail, item);
        detail.setContentMd(item.getContentMd() == null ? "" : item.getContentMd());
        detail.setRawHtml(item.getRawHtml());
        return detail;
    }

    /** 待处理数量（侧栏角标用） */
    public long pendingCount(Long userId) {
        return itemMapper.selectCount(new LambdaQueryWrapper<ClipItem>()
                .eq(ClipItem::getOwnerId, userId)
                .eq(ClipItem::getStatus, STATUS_PENDING));
    }

    // ------------------------------------------------------------------ 修改

    @Transactional
    public ClipItemView update(Long userId, Long id, ClipUpdateRequest request) {
        ClipItem item = requireItem(userId, id);

        if (request.getTitle() != null) {
            String title = request.getTitle().trim();
            if (title.isEmpty()) {
                throw new BusinessException(ErrorCode.PARAMS_ERROR, "标题不能为空");
            }
            item.setTitle(title.length() > 300 ? title.substring(0, 300) : title);
        }
        if (request.getTags() != null) {
            item.setTags(toArray(request.getTags()));
        }
        if (request.getContentMd() != null) {
            String markdown = request.getContentMd();
            item.setContentMd(markdown);
            item.setWordCount(countWords(markdown));
            item.setExcerpt(excerptOf(markdown));
        }
        if (request.getStatus() != null) {
            String status = request.getStatus().toLowerCase(Locale.ROOT);
            if (!STATUS_PENDING.equals(status) && !STATUS_DROPPED.equals(status)) {
                // archived 只能由入库接口产生，避免"标记已入库却没有文档"的脏状态
                throw new BusinessException(ErrorCode.PARAMS_ERROR, "只允许改为 pending / dropped");
            }
            item.setStatus(status);
        }
        item.setUpdatedAt(OffsetDateTime.now());
        itemMapper.updateById(item);

        if (Boolean.TRUE.equals(request.getClearRawHtml())) {
            itemMapper.update(null, new LambdaUpdateWrapper<ClipItem>()
                    .eq(ClipItem::getId, id)
                    .set(ClipItem::getRawHtml, null));
            item.setRawHtml(null);
        }
        return toView(item, false);
    }

    @Transactional
    public void delete(Long userId, Long id) {
        requireItem(userId, id);
        // 先清原文再软删：软删行不该继续占着大字段
        itemMapper.update(null, new LambdaUpdateWrapper<ClipItem>()
                .eq(ClipItem::getId, id)
                .set(ClipItem::getRawHtml, null));
        itemMapper.deleteById(id);
    }

    /**
     * 入库：建 knowledge_doc（Markdown 即权威正文）+ 默认向量化。
     * <p>已入库的直接返回原 docId，不产生第二篇文档。</p>
     */
    @Transactional
    public ClipImportResult toKnowledge(Long userId, Long id, ClipToKnowledgeRequest request) {
        ClipItem item = requireItem(userId, id);

        ClipImportResult result = new ClipImportResult();
        result.setClipId(id);

        if (item.getDocId() != null && STATUS_ARCHIVED.equals(item.getStatus())) {
            result.setDocId(item.getDocId());
            result.setVectorized(true);
            result.setAlreadyImported(true);
            return result;
        }
        if (item.getContentMd() == null || item.getContentMd().isBlank()) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "正文为空，无法入库（请先编辑正文或重新抓取）");
        }

        String title = request != null && request.getTitle() != null && !request.getTitle().isBlank()
                ? request.getTitle().trim() : item.getTitle();
        List<String> tags = request != null && request.getTags() != null && !request.getTags().isEmpty()
                ? request.getTags() : asList(item.getTags());

        DocSaveRequest docRequest = new DocSaveRequest();
        docRequest.setTitle(title);
        docRequest.setSummary(item.getExcerpt() == null ? "" : item.getExcerpt());
        docRequest.setFolderId(request == null ? null : request.getFolderId());
        docRequest.setTags(tags);
        docRequest.setBlockData("[]");
        docRequest.setMarkdownText(item.getContentMd());
        Long docId = knowledgeService.create(userId, docRequest);

        item.setDocId(docId);
        item.setStatus(STATUS_ARCHIVED);
        item.setUpdatedAt(OffsetDateTime.now());
        itemMapper.updateById(item);

        result.setDocId(docId);
        boolean needVectorize = request == null || request.getVectorize() == null || Boolean.TRUE.equals(request.getVectorize());
        if (needVectorize) {
            try {
                result.setChunkCount(vectorizeService.vectorize(userId, docId));
                result.setVectorized(true);
            } catch (Exception e) {
                // 文档已建好，向量化失败只降级提示，不回滚（用户可在知识库页重试）
                log.warn("剪藏入库后向量化失败: clipId={}, docId={}, reason={}", id, docId, e.toString());
                result.setVectorized(false);
                result.setError(shortMessage(e));
            }
        }
        log.info("剪藏入库: userId={}, clipId={}, docId={}, vectorized={}", userId, id, docId, result.isVectorized());
        return result;
    }

    // ------------------------------------------------------------------ 内部

    private ClipItem requireItem(Long userId, Long id) {
        ClipItem item = itemMapper.selectById(id);
        if (item == null || !userId.equals(item.getOwnerId())) {
            throw new BusinessException(ErrorCode.NOT_FOUND_ERROR, "剪藏不存在");
        }
        return item;
    }

    private ClipItem findSameUrl(Long userId, String url) {
        if (url == null || url.isBlank()) {
            return null;
        }
        return itemMapper.selectOne(new LambdaQueryWrapper<ClipItem>()
                .eq(ClipItem::getOwnerId, userId)
                .eq(ClipItem::getUrl, url)
                .last("limit 1"));
    }

    /** 配额：单账号总条数 + 当日抓取次数 */
    private void assertQuota(Long userId) {
        long total = itemMapper.selectCount(new LambdaQueryWrapper<ClipItem>()
                .eq(ClipItem::getOwnerId, userId));
        if (total >= properties.getMaxItems()) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR,
                    "收件箱已达 " + properties.getMaxItems() + " 条上限，请先清理已入库/已丢弃的条目");
        }
        OffsetDateTime todayStart = OffsetDateTime.now()
                .toLocalDate()
                .atStartOfDay(ZoneId.systemDefault())
                .toOffsetDateTime();
        long todayCount = itemMapper.selectCount(new LambdaQueryWrapper<ClipItem>()
                .eq(ClipItem::getOwnerId, userId)
                .ge(ClipItem::getCreatedAt, todayStart));
        if (todayCount >= properties.getDailyLimit()) {
            throw new BusinessException(ErrorCode.RATE_LIMIT_ERROR,
                    "今日剪藏已达 " + properties.getDailyLimit() + " 条上限，请明天再试");
        }
    }

    private ClipItemView toView(ClipItem item, boolean duplicate) {
        ClipItemView view = new ClipItemView();
        fillView(view, item);
        return view;
    }

    private void fillView(ClipItemView view, ClipItem item) {
        view.setId(item.getId());
        view.setUrl(item.getUrl() == null ? "" : item.getUrl());
        view.setSite(item.getSite() == null ? "" : item.getSite());
        view.setTitle(item.getTitle() == null ? "" : item.getTitle());
        view.setByline(item.getByline() == null ? "" : item.getByline());
        view.setExcerpt(item.getExcerpt() == null ? "" : item.getExcerpt());
        view.setWordCount(item.getWordCount() == null ? 0 : item.getWordCount());
        view.setQuality(item.getQuality() == null ? "ok" : item.getQuality());
        view.setChannel(item.getChannel() == null ? "url" : item.getChannel());
        view.setStatus(item.getStatus() == null ? STATUS_PENDING : item.getStatus());
        view.setError(item.getError() == null ? "" : item.getError());
        view.setTags(asList(item.getTags()));
        view.setDocId(item.getDocId());
        view.setCreatedAt(item.getCreatedAt() == null ? null : item.getCreatedAt().toEpochSecond() * 1000);
        view.setUpdatedAt(item.getUpdatedAt() == null ? null : item.getUpdatedAt().toEpochSecond() * 1000);
    }

    private String titleFromUrl(String url) {
        try {
            String host = new java.net.URI(url).getHost();
            return host == null || host.isBlank() ? url : host;
        } catch (Exception e) {
            return url == null ? "未命名剪藏" : url;
        }
    }

    private String siteOf(String url) {
        try {
            String host = new java.net.URI(url).getHost();
            return host == null ? "" : host.toLowerCase(Locale.ROOT);
        } catch (Exception e) {
            return "";
        }
    }

    private String[] toArray(List<String> values) {
        if (values == null || values.isEmpty()) {
            return new String[0];
        }
        List<String> cleaned = new ArrayList<>();
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                String tag = value.trim();
                if (tag.length() > 40) {
                    tag = tag.substring(0, 40);
                }
                if (!cleaned.contains(tag)) {
                    cleaned.add(tag);
                }
            }
        }
        return cleaned.toArray(new String[0]);
    }

    private List<String> asList(String[] values) {
        return values == null ? new ArrayList<>() : new ArrayList<>(Arrays.asList(values));
    }

    private String excerptOf(String markdown) {
        String plain = markdown == null ? "" : markdown.replaceAll("[#>*`\\[\\]()]", " ")
                .replaceAll("\\s+", " ").trim();
        return plain.length() <= 200 ? plain : plain.substring(0, 200);
    }

    private int countWords(String markdown) {
        if (markdown == null) {
            return 0;
        }
        String plain = markdown.replaceAll("[#>*`\\[\\]()]", " ");
        return (int) plain.chars().filter(ch -> !Character.isWhitespace(ch)).count();
    }

    private String shortMessage(Exception e) {
        String message = e.getMessage();
        if (message == null || message.isBlank()) {
            return e.getClass().getSimpleName();
        }
        return message.length() <= 200 ? message : message.substring(0, 200);
    }
}
