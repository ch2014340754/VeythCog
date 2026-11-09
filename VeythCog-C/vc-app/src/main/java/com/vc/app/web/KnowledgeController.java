package com.vc.app.web;

import com.vc.app.orchestration.DocMetadata;
import com.vc.app.orchestration.KnowledgeMetadataOrchestrator;
import com.vc.app.orchestration.VectorizeResult;
import com.vc.common.BaseResponse;
import com.vc.common.ResultUtils;
import com.vc.common.exception.BusinessException;
import com.vc.common.exception.ErrorCode;
import com.vc.knowledge.dto.DocDetail;
import com.vc.knowledge.dto.DocListItem;
import com.vc.knowledge.dto.DocSaveRequest;
import com.vc.knowledge.dto.PageResult;
import com.vc.knowledge.dto.RetrieveChunk;
import com.vc.knowledge.dto.RetrieveRequest;
import com.vc.knowledge.service.KnowledgeService;
import com.vc.knowledge.service.VectorizeService;
import jakarta.validation.Valid;
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
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.CompletableFuture;

/**
 * 知识库接口（P0）。
 * <p>权限：知识库为登录用户私有数据，所有接口均需登录（Security 统一鉴权）。</p>
 */
@RestController
@RequestMapping("/knowledge")
public class KnowledgeController {

    private static final long MAX_MD_SIZE = 500 * 1024L;

    private final KnowledgeService knowledgeService;
    private final VectorizeService vectorizeService;
    private final KnowledgeMetadataOrchestrator metadataOrchestrator;

    public KnowledgeController(KnowledgeService knowledgeService,
                               VectorizeService vectorizeService,
                               KnowledgeMetadataOrchestrator metadataOrchestrator) {
        this.knowledgeService = knowledgeService;
        this.vectorizeService = vectorizeService;
        this.metadataOrchestrator = metadataOrchestrator;
    }

    /** 1. 文档列表（关键词走 PG simple 文本检索） */
    @GetMapping("/list")
    public BaseResponse<PageResult<DocListItem>> list(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String tag,
            @RequestParam(required = false) String sortField,
            @RequestParam(required = false) String sortOrder,
            @RequestParam(defaultValue = "1") int current,
            @RequestParam(defaultValue = "10") int pageSize) {
        List<String> tags = tag == null || tag.isBlank() ? List.of() : List.of(tag.trim());
        return ResultUtils.success(knowledgeService.list(
                currentUserIdOrNull(), keyword, tags, sortField, sortOrder, current, pageSize));
    }

    /** 2. 文档详情 */
    @GetMapping("/doc/{docId}")
    public BaseResponse<DocDetail> get(@PathVariable Long docId) {
        return ResultUtils.success(knowledgeService.get(currentUserIdOrNull(), docId));
    }

    /** 3. 新建文档 */
    @PostMapping("/doc")
    public BaseResponse<Long> create(@Valid @RequestBody DocSaveRequest body) {
        return ResultUtils.success(knowledgeService.create(currentUserIdOrNull(), body));
    }

    /** 4. 更新文档 */
    @PutMapping("/doc/{docId}")
    public BaseResponse<Void> update(@PathVariable Long docId, @Valid @RequestBody DocSaveRequest body) {
        knowledgeService.update(currentUserIdOrNull(), docId, body);
        return ResultUtils.success(null);
    }

    /** 5. 删除文档（软删除 + 显式清理 embedding） */
    @DeleteMapping("/doc/{docId}")
    public BaseResponse<Void> delete(@PathVariable Long docId) {
        knowledgeService.delete(currentUserIdOrNull(), docId);
        return ResultUtils.success(null);
    }

    /** 6. 导入 Markdown（≤500KB，仅 .md） */
    @PostMapping("/import/md")
    public BaseResponse<Long> importMd(
            @RequestParam("file") MultipartFile file,
            @RequestParam(required = false) String title,
            @RequestParam(required = false) String tags) {
        if (file.isEmpty() || file.getSize() > MAX_MD_SIZE) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "文件为空或超过 500KB");
        }
        String filename = file.getOriginalFilename();
        if (filename == null || !filename.toLowerCase().endsWith(".md")) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "仅支持 .md 文件");
        }
        try {
            String md = new String(file.getBytes(), StandardCharsets.UTF_8);
            List<String> tagList = tags == null || tags.isBlank()
                    ? List.of()
                    : Arrays.stream(tags.split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList();
            return ResultUtils.success(knowledgeService.importMd(
                    currentUserIdOrNull(), title, tagList, md));
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "文件读取失败");
        }
    }

    /** 7. 导出 Markdown 下载流 */
    @GetMapping("/doc/{docId}/export/md")
    public ResponseEntity<byte[]> exportMd(@PathVariable Long docId) {
        String md = knowledgeService.exportMd(currentUserIdOrNull(), docId);
        byte[] bytes = md.getBytes(StandardCharsets.UTF_8);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"doc-" + docId + ".md\"")
                .contentType(MediaType.parseMediaType("text/markdown;charset=UTF-8"))
                .body(bytes);
    }

    /** 8. 向量化：embedding 与元数据生成并行，只补齐空值，失败不阻断 */
    @PostMapping("/doc/{docId}/vectorize")
    public BaseResponse<VectorizeResult> vectorize(@PathVariable Long docId) {
        Long userId = currentUserIdOrNull();
        // 摘要/标签生成与 embedding 并行，减少用户等待；落库放在向量化完成之后，避免并发覆盖
        CompletableFuture<DocMetadata> metaFuture = metadataOrchestrator.generateAsync(userId, docId);
        int count = vectorizeService.vectorize(userId, docId);
        DocMetadata generated = metadataOrchestrator.awaitSafely(metaFuture);
        DocMetadata effective = metadataOrchestrator.fillIfBlank(userId, docId, generated);
        return ResultUtils.success(new VectorizeResult(count, effective.getSummary(), effective.getTags()));
    }

    /** 8.1 显式重新生成元数据（覆盖手写内容，需前端二次确认） */
    @PostMapping("/doc/{docId}/metadata/regenerate")
    public BaseResponse<DocMetadata> regenerateMetadata(@PathVariable Long docId) {
        return ResultUtils.success(metadataOrchestrator.regenerate(currentUserIdOrNull(), docId));
    }

    /** 9. 取消向量化 */
    @PostMapping("/doc/{docId}/unvectorize")
    public BaseResponse<Void> unvectorize(@PathVariable Long docId) {
        vectorizeService.unvectorize(currentUserIdOrNull(), docId);
        return ResultUtils.success(null);
    }

    /** 10. RAG 召回 */
    @PostMapping("/rag/retrieve")
    public BaseResponse<List<RetrieveChunk>> retrieve(@Valid @RequestBody RetrieveRequest body) {
        return ResultUtils.success(vectorizeService.retrieve(
                currentUserIdOrNull(), body.getDocIds(), body.getQuery(), body.getTopN()));
    }

    private Long currentUserIdOrNull() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof Long userId)) {
            return null;
        }
        return userId;
    }
}
