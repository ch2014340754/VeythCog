package com.vc.knowledge.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.vc.common.exception.BusinessException;
import com.vc.common.exception.ErrorCode;
import com.vc.knowledge.dto.DocNode;
import com.vc.knowledge.dto.FolderNode;
import com.vc.knowledge.dto.FolderStats;
import com.vc.knowledge.dto.KnowledgeTree;
import com.vc.knowledge.entity.KnowledgeDoc;
import com.vc.knowledge.entity.KnowledgeEmbedding;
import com.vc.knowledge.entity.KnowledgeFolder;
import com.vc.knowledge.mapper.KnowledgeDocMapper;
import com.vc.knowledge.mapper.KnowledgeFolderMapper;
import com.vc.knowledge.service.KnowledgeEmbeddingService;
import com.vc.knowledge.service.KnowledgeFolderService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/**
 * 知识库目录服务实现。
 * <p>普通 CRUD 走 MyBatis-Plus（@TableLogic 自动过滤软删除）；递归后代 / 批量软删走
 * {@link KnowledgeFolderMapper} 的 XML（PG 递归 CTE，注意自定义 SQL 必须显式带 deleted 条件）。</p>
 */
@Service
public class KnowledgeFolderServiceImpl implements KnowledgeFolderService {

    private static final Logger log = LoggerFactory.getLogger(KnowledgeFolderServiceImpl.class);

    /** 目录名最大长度（与 DDL 的 VARCHAR(100) 一致） */
    private static final int MAX_NAME_LENGTH = 100;
    /** 最大层级（根级为第 1 层） */
    private static final int MAX_DEPTH = 8;
    /** 批量 SQL 的 IN 上限 */
    private static final int BATCH_SIZE = 200;

    private final KnowledgeFolderMapper folderMapper;
    private final KnowledgeDocMapper docMapper;
    private final KnowledgeEmbeddingService embeddingService;

    public KnowledgeFolderServiceImpl(KnowledgeFolderMapper folderMapper,
                                      KnowledgeDocMapper docMapper,
                                      KnowledgeEmbeddingService embeddingService) {
        this.folderMapper = folderMapper;
        this.docMapper = docMapper;
        this.embeddingService = embeddingService;
    }

    // ============================ 树查询 ============================

    @Override
    public KnowledgeTree tree(String keyword) {
        List<KnowledgeFolder> folders = folderMapper.selectList(Wrappers.<KnowledgeFolder>lambdaQuery()
                .orderByAsc(KnowledgeFolder::getSortOrder)
                .orderByAsc(KnowledgeFolder::getName));
        List<KnowledgeDoc> docs = docMapper.selectTreeDocs(keyword == null || keyword.isBlank() ? null : keyword.trim());

        Set<Long> folderIds = new HashSet<>();
        Map<Long, Long> parentOf = new LinkedHashMap<>();
        for (KnowledgeFolder f : folders) {
            folderIds.add(f.getId());
            parentOf.put(f.getId(), f.getParentId());
        }

        // 防御：父目录已被删除的孤儿目录按根级处理，不让异常数据把整棵树挂掉
        List<FolderNode> folderNodes = new ArrayList<>(folders.size());
        for (KnowledgeFolder f : folders) {
            Long parentId = f.getParentId();
            if (parentId != null && !folderIds.contains(parentId)) {
                log.warn("knowledge folder {} has deleted parent {}, fallback to root", f.getId(), parentId);
                parentId = null;
            }
            FolderNode node = new FolderNode();
            node.setId(f.getId());
            node.setParentId(parentId);
            node.setName(f.getName());
            node.setSortOrder(f.getSortOrder());
            folderNodes.add(node);
        }

        // 关键词命中时，保留命中目录的祖先链
        final Set<Long> visibleFolders;
        if (keyword != null && !keyword.isBlank()) {
            visibleFolders = new HashSet<>();
            for (KnowledgeDoc d : docs) {
                Long fid = d.getFolderId();
                int guard = 0;
                while (fid != null && guard++ <= folderIds.size()) {
                    if (!visibleFolders.add(fid)) {
                        break;
                    }
                    fid = parentOf.get(fid);
                }
            }
            folderNodes = folderNodes.stream().filter(n -> visibleFolders.contains(n.getId())).toList();
        }

        List<DocNode> docNodes = new ArrayList<>(docs.size());
        for (KnowledgeDoc d : docs) {
            Long folderId = d.getFolderId();
            if (folderId != null && !folderIds.contains(folderId)) {
                log.warn("knowledge doc {} points to deleted folder {}, fallback to root", d.getId(), folderId);
                folderId = null;
            }
            DocNode node = new DocNode();
            node.setId(d.getId());
            node.setFolderId(folderId);
            node.setTitle(d.getTitle());
            node.setSummary(d.getSummary());
            node.setTags(d.getTags() == null ? List.of() : Arrays.asList(d.getTags()));
            node.setIsVectorized(d.getIsVectorized());
            node.setUpdatedAt(d.getUpdatedAt() == null ? null : d.getUpdatedAt().toInstant().toEpochMilli());
            docNodes.add(node);
        }

        long total = docMapper.selectCount(Wrappers.<KnowledgeDoc>lambdaQuery());
        KnowledgeTree tree = new KnowledgeTree();
        tree.setFolders(folderNodes);
        tree.setDocs(docNodes);
        tree.setTotal(total);
        tree.setMatchedCount(docNodes.size());
        return tree;
    }

    // ============================ 目录写操作 ============================

    @Override
    @Transactional
    public Long create(Long parentId, String rawName) {
        if (parentId != null) {
            requireFolder(parentId);
        }
        String name = normalizeName(rawName);
        int childDepth = (parentId == null ? 1 : depthOf(parentId) + 1);
        if (childDepth > MAX_DEPTH) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "目录层级过深（最多 " + MAX_DEPTH + " 层）");
        }
        ensureSiblingNameFree(parentId, name, null);

        KnowledgeFolder folder = new KnowledgeFolder();
        folder.setParentId(parentId);
        folder.setName(name);
        folder.setSortOrder(0);
        folder.setUpdatedAt(OffsetDateTime.now());
        try {
            folderMapper.insert(folder);
        } catch (DuplicateKeyException e) {
            // 唯一索引兜底：并发建同名目录
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "同级已存在同名目录");
        }
        return folder.getId();
    }

    @Override
    @Transactional
    public void rename(Long folderId, String rawName) {
        KnowledgeFolder folder = requireFolderEntity(folderId);
        String name = normalizeName(rawName);
        if (name.equals(folder.getName())) {
            return;
        }
        ensureSiblingNameFree(folder.getParentId(), name, folderId);

        KnowledgeFolder patch = new KnowledgeFolder();
        patch.setId(folderId);
        patch.setName(name);
        patch.setUpdatedAt(OffsetDateTime.now());
        try {
            folderMapper.updateById(patch);
        } catch (DuplicateKeyException e) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "同级已存在同名目录");
        }
    }

    @Override
    @Transactional
    public void delete(Long folderId, boolean recursive) {
        requireFolder(folderId);
        List<Long> ids = folderMapper.selectDescendantIds(folderId);
        if (ids.isEmpty()) {
            ids = List.of(folderId);
        }
        List<Long> docIds = folderMapper.selectDocIdsByFolderIds(ids);
        long childFolderCount = ids.size() - 1;

        if (!recursive && (childFolderCount > 0 || !docIds.isEmpty())) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "目录非空，请先清空或选择递归删除");
        }

        // 1) 先清向量（软删不触发 FK 级联，与 KnowledgeServiceImpl.delete 保持一致）
        for (List<Long> chunk : partition(docIds)) {
            embeddingService.remove(new LambdaQueryWrapper<KnowledgeEmbedding>()
                    .in(KnowledgeEmbedding::getDocId, chunk));
        }
        // 2) 软删文档
        for (List<Long> chunk : partition(ids)) {
            folderMapper.softDeleteDocsByFolderIds(chunk);
        }
        // 3) 软删目录（含自身与全部后代）
        for (List<Long> chunk : partition(ids)) {
            folderMapper.softDeleteFolders(chunk);
        }
    }

    @Override
    public FolderStats stats(Long folderId) {
        requireFolder(folderId);
        List<Long> ids = folderMapper.selectDescendantIds(folderId);
        if (ids.isEmpty()) {
            ids = List.of(folderId);
        }
        FolderStats stats = new FolderStats();
        stats.setDocCount(folderMapper.countDocsByFolderIds(ids));
        stats.setFolderCount(Math.max(0, ids.size() - 1));
        return stats;
    }

    @Override
    @Transactional
    public void move(Long folderId, Long targetParentId) {
        requireFolder(folderId);
        if (targetParentId != null) {
            requireFolder(targetParentId);
            Set<Long> descendants = new HashSet<>(folderMapper.selectDescendantIds(folderId));
            if (descendants.contains(targetParentId)) {
                throw new BusinessException(ErrorCode.PARAMS_ERROR, "不能移动到自身或其子目录");
            }
            if (depthOf(targetParentId) + 1 > MAX_DEPTH) {
                throw new BusinessException(ErrorCode.PARAMS_ERROR, "目录层级过深（最多 " + MAX_DEPTH + " 层）");
            }
        }
        try {
            folderMapper.updateParent(folderId, targetParentId);
        } catch (DuplicateKeyException e) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "同级已存在同名目录");
        }
    }

    @Override
    public byte[] exportZip(Long folderId, List<Long> docIds) {
        List<KnowledgeFolder> folders = folderMapper.selectList(Wrappers.<KnowledgeFolder>lambdaQuery()
                .orderByAsc(KnowledgeFolder::getId));
        Map<Long, KnowledgeFolder> byId = new java.util.HashMap<>();
        for (KnowledgeFolder f : folders) {
            byId.put(f.getId(), f);
        }

        // 优先级：勾选的文档 > 目录子树 > 全库
        boolean byDocIds = docIds != null && !docIds.isEmpty();
        List<Long> scopeIds = null;
        if (!byDocIds) {
            if (folderId != null) {
                requireFolder(folderId);
                scopeIds = folderMapper.selectDescendantIds(folderId);
                if (scopeIds.isEmpty()) {
                    scopeIds = List.of(folderId);
                }
            }
        }

        LambdaQueryWrapper<KnowledgeDoc> q = Wrappers.<KnowledgeDoc>lambdaQuery()
                .select(KnowledgeDoc::getId, KnowledgeDoc::getTitle,
                        KnowledgeDoc::getFolderId, KnowledgeDoc::getMarkdownText)
                .orderByAsc(KnowledgeDoc::getFolderId)
                .orderByAsc(KnowledgeDoc::getId);
        if (byDocIds) {
            q.in(KnowledgeDoc::getId, docIds);
        } else if (scopeIds != null) {
            q.in(KnowledgeDoc::getFolderId, scopeIds);
        }
        List<KnowledgeDoc> docs = docMapper.selectList(q);

        Map<String, Integer> usedNames = new java.util.HashMap<>();
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        try (ZipOutputStream zos = new ZipOutputStream(bos, StandardCharsets.UTF_8)) {
            for (KnowledgeDoc d : docs) {
                String dir = folderPathOf(d.getFolderId(), byId);
                String base = safeSegment(d.getTitle());
                if (base.isEmpty()) {
                    base = "untitled-" + d.getId();
                }
                // 同一目录下重名文档追加序号，避免 zip 内条目冲突
                String dedupKey = dir + '\u0000' + base;
                int seq = usedNames.merge(dedupKey, 1, Integer::sum);
                String fileName = (seq > 1 ? base + "-" + seq : base) + ".md";
                String entryName = dir.isEmpty() ? fileName : dir + "/" + fileName;
                zos.putNextEntry(new ZipEntry(entryName));
                String md = d.getMarkdownText() == null ? "" : d.getMarkdownText();
                zos.write(md.getBytes(StandardCharsets.UTF_8));
                zos.closeEntry();
            }
        } catch (IOException e) {
            log.error("export zip failed, folderId={}", folderId, e);
            throw new BusinessException(ErrorCode.OPERATION_ERROR, "导出失败：" + e.getMessage());
        }
        return bos.toByteArray();
    }

    /** 目录的路径串（根级返回空串），带环保护。 */
    private String folderPathOf(Long folderId, Map<Long, KnowledgeFolder> byId) {
        if (folderId == null) {
            return "";
        }
        List<String> parts = new ArrayList<>();
        Set<Long> seen = new HashSet<>();
        Long cursor = folderId;
        while (cursor != null && seen.add(cursor)) {
            KnowledgeFolder f = byId.get(cursor);
            if (f == null) {
                break;
            }
            parts.add(safeSegment(f.getName()));
            cursor = f.getParentId();
        }
        java.util.Collections.reverse(parts);
        return String.join("/", parts);
    }

    /** 文件名安全化：去掉路径分隔符 / 控制字符 / Windows 保留字符，限制长度。 */
    private String safeSegment(String raw) {
        String name = raw == null ? "" : raw.trim();
        StringBuilder sb = new StringBuilder(name.length());
        for (int i = 0; i < name.length(); i++) {
            char c = name.charAt(i);
            if (Character.isISOControl(c) || "/\\:*?\"<>|".indexOf(c) >= 0) {
                sb.append('_');
            } else {
                sb.append(c);
            }
        }
        String out = sb.toString().trim();
        return out.length() > 60 ? out.substring(0, 60) : out;
    }

    @Override
    public void requireFolder(Long folderId) {        if (folderId == null) {
            return;
        }
        if (folderMapper.selectById(folderId) == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND_ERROR, "目录不存在");
        }
    }

    // ============================ 私有辅助 ============================

    private KnowledgeFolder requireFolderEntity(Long folderId) {
        KnowledgeFolder folder = folderMapper.selectById(folderId);
        if (folder == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND_ERROR, "目录不存在");
        }
        return folder;
    }

    private String normalizeName(String raw) {
        String name = raw == null ? "" : raw.trim();
        if (name.isEmpty()) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "目录名不能为空");
        }
        if (name.length() > MAX_NAME_LENGTH) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "目录名不能超过 " + MAX_NAME_LENGTH + " 字");
        }
        for (int i = 0; i < name.length(); i++) {
            char c = name.charAt(i);
            if (c == '/' || Character.isISOControl(c)) {
                throw new BusinessException(ErrorCode.PARAMS_ERROR, "目录名不能包含 / 或控制字符");
            }
        }
        return name;
    }

    /** 同级去重；excludeId 用于重命名时排除自身。 */
    private void ensureSiblingNameFree(Long parentId, String name, Long excludeId) {
        LambdaQueryWrapper<KnowledgeFolder> q = Wrappers.<KnowledgeFolder>lambdaQuery()
                .eq(KnowledgeFolder::getName, name);
        if (parentId == null) {
            q.isNull(KnowledgeFolder::getParentId);
        } else {
            q.eq(KnowledgeFolder::getParentId, parentId);
        }
        if (excludeId != null) {
            q.ne(KnowledgeFolder::getId, excludeId);
        }
        if (folderMapper.selectCount(q) > 0) {
            throw new BusinessException(ErrorCode.PARAMS_ERROR, "同级已存在同名目录");
        }
    }

    /** 目录深度：根级为 1；带环保护，脏数据不会死循环。 */
    private int depthOf(Long folderId) {
        int depth = 0;
        Long cursor = folderId;
        Set<Long> seen = new HashSet<>();
        while (cursor != null && seen.add(cursor)) {
            KnowledgeFolder f = folderMapper.selectById(cursor);
            if (f == null) {
                break;
            }
            depth++;
            cursor = f.getParentId();
        }
        return depth;
    }

    private List<List<Long>> partition(List<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            return List.of();
        }
        List<List<Long>> chunks = new ArrayList<>();
        for (int i = 0; i < ids.size(); i += BATCH_SIZE) {
            chunks.add(ids.subList(i, Math.min(i + BATCH_SIZE, ids.size())));
        }
        return chunks;
    }
}
