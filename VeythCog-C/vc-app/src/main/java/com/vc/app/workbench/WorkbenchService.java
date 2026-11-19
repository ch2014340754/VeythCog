package com.vc.app.workbench;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.vc.app.workbench.dto.WorkbenchOverview;
import com.vc.chat.ChatHistoryService;
import com.vc.chat.dto.ChatConversationVO;
import com.vc.knowledge.clip.entity.ClipItem;
import com.vc.knowledge.clip.mapper.ClipItemMapper;
import com.vc.knowledge.dto.DocListItem;
import com.vc.knowledge.entity.KnowledgeFolder;
import com.vc.knowledge.mapper.KnowledgeFolderMapper;
import com.vc.knowledge.service.KnowledgeService;
import com.vc.nav.entity.NavBookmark;
import com.vc.nav.mapper.NavBookmarkMapper;
import com.vc.user.todo.TodoService;
import com.vc.user.todo.dto.TodoItemView;
import jakarta.annotation.PreDestroy;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Supplier;
import java.util.stream.Collectors;

/**
 * 工作台聚合：把首页需要的 5 块数据并行取回，任一子块失败/超时只降级该块。
 *
 * <p>约定：</p>
 * <ul>
 *   <li>单块超时 800ms；超时后返回该块的空默认值，{@code partial=true}。</li>
 *   <li>空库不是错误：全部数组为空、stats 全 0、partial=false。</li>
 *   <li>全部时间为 ms；<b>不</b>在这里做任何写操作或缓存失效。</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class WorkbenchService {

    private static final int TIMEOUT_MS = 800;

    /** 待向量化提醒的正文阈值：太短的空白文档不提醒 */
    private static final int PENDING_VECTOR_MIN_CHARS = 200;

    private static final int TODO_LIMIT = 4;
    private static final int DOC_LIMIT = 5;
    private static final int CLIP_LIMIT = 3;
    private static final int CONVERSATION_LIMIT = 3;

    private final TodoService todoService;
    private final KnowledgeService knowledgeService;
    private final KnowledgeFolderMapper folderMapper;
    private final ClipItemMapper clipItemMapper;
    private final NavBookmarkMapper bookmarkMapper;
    private final ChatHistoryService chatHistoryService;

    /** 专用小池：不让工作台读请求占用公共 ForkJoin，也不随请求创建线程 */
    private final ExecutorService executor = Executors.newFixedThreadPool(6, r -> {
        Thread thread = new Thread(r, "workbench-overview");
        thread.setDaemon(true);
        return thread;
    });

    @PreDestroy
    void shutdown() {
        executor.shutdownNow();
    }

    public WorkbenchOverview overview(Long userId) {
        AtomicBoolean partial = new AtomicBoolean(false);

        CompletableFuture<WorkbenchOverview.Stats> statsFuture =
                async(() -> buildStats(userId, partial), partial, new WorkbenchOverview.Stats());
        CompletableFuture<List<WorkbenchOverview.TodoBrief>> todosFuture =
                async(() -> buildTodos(userId), partial, List.of());
        CompletableFuture<List<WorkbenchOverview.RecentDoc>> docsFuture =
                async(this::buildRecentDocs, partial, List.of());
        CompletableFuture<List<WorkbenchOverview.UnreadClip>> clipsFuture =
                async(this::buildUnreadClips, partial, List.of());
        CompletableFuture<List<WorkbenchOverview.RecentConversation>> convFuture =
                async(() -> buildConversations(userId), partial, List.of());

        WorkbenchOverview.Stats stats = statsFuture.join();

        WorkbenchOverview overview = new WorkbenchOverview();
        overview.setGeneratedAt(System.currentTimeMillis());
        overview.setStats(stats);
        overview.setTodos(todosFuture.join());
        overview.setRecentDocs(docsFuture.join());
        overview.setUnreadClips(clipsFuture.join());
        overview.setRecentConversations(convFuture.join());
        overview.setTasks(buildTasks(stats));
        overview.setPartial(partial.get());
        return overview;
    }

    /** 单块异步 + 超时 + 异常兜底；异常/超时都置 partial */
    private <T> CompletableFuture<T> async(Supplier<T> supplier, AtomicBoolean partial, T fallback) {
        return CompletableFuture.supplyAsync(supplier, executor)
                .orTimeout(TIMEOUT_MS, TimeUnit.MILLISECONDS)
                .exceptionally(e -> {
                    partial.set(true);
                    return fallback;
                });
    }

    /**
     * 统计块：每个数字独立 try/catch，单个失败只把该数字置 0 并标记 partial，
     * 不连带整块丢失（首页数字比"全空"更值得保留）。
     */
    private WorkbenchOverview.Stats buildStats(Long userId, AtomicBoolean partial) {
        WorkbenchOverview.Stats stats = new WorkbenchOverview.Stats();
        stats.setUnreadClips(safeCount(partial, () -> clipItemMapper.selectCount(
                Wrappers.<ClipItem>lambdaQuery().eq(ClipItem::getStatus, "pending"))));
        stats.setPendingVectorDocs(safeCount(partial,
                () -> knowledgeService.countPendingVector(PENDING_VECTOR_MIN_CHARS)));
        stats.setOpenTodos(safeCount(partial, () -> todoService.countOpen(userId)));
        stats.setTodayDueTodos(safeCount(partial, () -> todoService.countDueToday(userId)));
        stats.setTotalDocs(safeCount(partial, () -> (long) knowledgeService
                .list(userId, "", null, null, null, 1, 1).getTotal()));
        stats.setTotalBookmarks(safeCount(partial,
                () -> (long) bookmarkMapper.selectCount(Wrappers.<NavBookmark>lambdaQuery())));
        stats.setTotalConversations(safeCount(partial,
                () -> (long) chatHistoryService.listConversations(userId).size()));
        return stats;
    }

    private long safeCount(AtomicBoolean partial, Supplier<Long> supplier) {
        try {
            Long value = supplier.get();
            return value == null ? 0L : value;
        } catch (Exception e) {
            partial.set(true);
            return 0L;
        }
    }

    private List<WorkbenchOverview.TodoBrief> buildTodos(Long userId) {
        List<TodoItemView> rows = todoService.openBrief(userId, TODO_LIMIT);
        List<WorkbenchOverview.TodoBrief> result = new ArrayList<>(rows.size());
        for (TodoItemView row : rows) {
            WorkbenchOverview.TodoBrief brief = new WorkbenchOverview.TodoBrief();
            brief.setId(row.getId());
            brief.setTitle(row.getTitle());
            brief.setPriority(row.getPriority() == null ? 1 : row.getPriority());
            brief.setDueDate(row.getDueDate());
            brief.setOverdue(Boolean.TRUE.equals(row.getOverdue()));
            result.add(brief);
        }
        return result;
    }

    private List<WorkbenchOverview.RecentDoc> buildRecentDocs() {
        List<DocListItem> docs = knowledgeService.recentDocs(DOC_LIMIT);
        if (docs.isEmpty()) {
            return List.of();
        }
        Map<Long, KnowledgeFolder> folders = loadFolders();
        List<WorkbenchOverview.RecentDoc> result = new ArrayList<>(docs.size());
        for (DocListItem doc : docs) {
            WorkbenchOverview.RecentDoc item = new WorkbenchOverview.RecentDoc();
            item.setId(doc.getId());
            item.setTitle(doc.getTitle());
            item.setSummary(truncate(doc.getSummary(), 60));
            item.setFolderId(doc.getFolderId());
            item.setFolderPath(folderPath(doc.getFolderId(), folders));
            item.setIsVectorized(doc.getIsVectorized());
            item.setUpdatedAt(doc.getUpdatedAt() == null ? 0L : doc.getUpdatedAt());
            result.add(item);
        }
        return result;
    }

    private Map<Long, KnowledgeFolder> loadFolders() {
        try {
            return folderMapper.selectList(null).stream()
                    .filter(f -> !Boolean.TRUE.equals(f.getDeleted()))
                    .collect(Collectors.toMap(KnowledgeFolder::getId, f -> f, (a, b) -> a));
        } catch (Exception e) {
            // 路径只是装饰，取不到就当根级，不影响文档标题
            return Map.of();
        }
    }

    /** 递归拼 "父/子"；最多 8 层防环，断链按已拼部分返回 */
    private String folderPath(Long folderId, Map<Long, KnowledgeFolder> folders) {
        if (folderId == null) {
            return "/";
        }
        Deque<String> names = new ArrayDeque<>();
        Long cursor = folderId;
        int guard = 0;
        while (cursor != null && guard++ < 8) {
            KnowledgeFolder folder = folders.get(cursor);
            if (folder == null) {
                break;
            }
            names.addFirst(folder.getName());
            cursor = folder.getParentId();
        }
        return names.isEmpty() ? "/" : String.join("/", names);
    }

    private List<WorkbenchOverview.UnreadClip> buildUnreadClips() {
        List<ClipItem> rows = clipItemMapper.selectList(Wrappers.<ClipItem>lambdaQuery()
                .eq(ClipItem::getStatus, "pending")
                .orderByDesc(ClipItem::getCreatedAt)
                .last("LIMIT " + CLIP_LIMIT));
        List<WorkbenchOverview.UnreadClip> result = new ArrayList<>(rows.size());
        for (ClipItem row : rows) {
            WorkbenchOverview.UnreadClip item = new WorkbenchOverview.UnreadClip();
            item.setId(row.getId());
            item.setTitle(row.getTitle());
            item.setSite(row.getSite());
            item.setUrl(row.getUrl());
            item.setCreatedAt(row.getCreatedAt() == null ? 0L : row.getCreatedAt().toInstant().toEpochMilli());
            result.add(item);
        }
        return result;
    }

    private List<WorkbenchOverview.RecentConversation> buildConversations(Long userId) {
        List<ChatConversationVO> rows = chatHistoryService.listConversations(userId);
        List<WorkbenchOverview.RecentConversation> result = new ArrayList<>(CONVERSATION_LIMIT);
        for (ChatConversationVO row : rows) {
            if (result.size() >= CONVERSATION_LIMIT) {
                break;
            }
            WorkbenchOverview.RecentConversation item = new WorkbenchOverview.RecentConversation();
            item.setId(row.getId());
            item.setTitle(row.getTitle());
            item.setModelName(row.getModelCode());
            item.setMessageCount(row.getMessageCount() == null ? 0 : row.getMessageCount());
            item.setUpdatedAt(row.getUpdatedAt() == null ? 0L : row.getUpdatedAt());
            result.add(item);
        }
        return result;
    }

    /** 派生待办：count=0 不返回；最多 2 项 */
    private List<WorkbenchOverview.TaskItem> buildTasks(WorkbenchOverview.Stats stats) {
        List<WorkbenchOverview.TaskItem> tasks = new ArrayList<>(2);
        if (stats.getUnreadClips() > 0) {
            tasks.add(new WorkbenchOverview.TaskItem("clip",
                    stats.getUnreadClips() + " 条剪藏待处理", stats.getUnreadClips(),
                    "/inbox?status=pending", "warn"));
        }
        if (stats.getPendingVectorDocs() > 0) {
            tasks.add(new WorkbenchOverview.TaskItem("vectorize",
                    stats.getPendingVectorDocs() + " 篇文档待向量化", stats.getPendingVectorDocs(),
                    "/knowledge?filter=unvectorized", "info"));
        }
        return tasks;
    }

    private String truncate(String text, int max) {
        if (text == null) {
            return "";
        }
        String flat = text.replaceAll("\\s+", " ").trim();
        return flat.length() <= max ? flat : flat.substring(0, max) + "…";
    }
}
