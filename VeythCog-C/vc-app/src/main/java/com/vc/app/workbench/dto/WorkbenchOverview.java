package com.vc.app.workbench.dto;

import lombok.Data;

import java.io.Serializable;
import java.util.List;

/**
 * 工作台聚合视图（GET /workbench/overview）。
 *
 * <p>只读、不落库；各子块独立降级——某一块查询失败或超时不影响其它块，
 * 仅把 {@link #partial} 置 true，前端顶部给一条轻提示。</p>
 */
@Data
public class WorkbenchOverview implements Serializable {

    /** 服务端生成时间戳（ms），前端用于"x 分钟前" */
    private long generatedAt;

    /** 任一子块降级为 true */
    private boolean partial;

    private Stats stats;

    /** 派生待处理项（剪藏 / 待向量化）；count=0 的项不出现，最多 2 项 */
    private List<TaskItem> tasks;

    /** 我的待办：未完成前 4 条 */
    private List<TodoBrief> todos;

    /** 最近更新文档，最多 5 条 */
    private List<RecentDoc> recentDocs;

    /** 待处理剪藏，最多 3 条 */
    private List<UnreadClip> unreadClips;

    /** 最近对话，最多 3 条 */
    private List<RecentConversation> recentConversations;

    @Data
    public static class Stats implements Serializable {

        /** 待处理剪藏 */
        private long unreadClips;

        /** 待向量化文档（正文 ≥200 字） */
        private long pendingVectorDocs;

        /** 未完成待办总数 */
        private long openTodos;

        /** due_date <= 今天 的未完成待办 */
        private long todayDueTodos;

        /** 未删除文档总数 */
        private long totalDocs;

        /** 书签总数 */
        private long totalBookmarks;

        /** 会话总数（软删除除外） */
        private long totalConversations;
    }

    @Data
    public static class TaskItem implements Serializable {

        /** clip / vectorize */
        private String key;

        /** "3 条剪藏待处理" */
        private String label;

        private long count;

        /** /inbox?status=pending / /knowledge?filter=unvectorized */
        private String href;

        /** warn / info（只决定圆点颜色） */
        private String tone;

        public TaskItem() {
        }

        public TaskItem(String key, String label, long count, String href, String tone) {
            this.key = key;
            this.label = label;
            this.count = count;
            this.href = href;
            this.tone = tone;
        }
    }

    @Data
    public static class TodoBrief implements Serializable {

        private long id;

        private String title;

        /** 0 低 / 1 普通 / 2 高 */
        private int priority;

        /** yyyy-MM-dd；null = 无截止日 */
        private String dueDate;

        /** dueDate < 今天且未完成 */
        private boolean overdue;
    }

    @Data
    public static class RecentDoc implements Serializable {

        private long id;

        private String title;

        /** 截断到 60 字 */
        private String summary;

        /** null = 根级 */
        private Long folderId;

        /** "技术/中间件"；根级为 "/" */
        private String folderPath;

        private Boolean isVectorized;

        /** ms */
        private long updatedAt;
    }

    @Data
    public static class UnreadClip implements Serializable {

        private long id;

        private String title;

        private String site;

        private String url;

        /** ms */
        private long createdAt;
    }

    @Data
    public static class RecentConversation implements Serializable {

        private String id;

        private String title;

        private String modelName;

        private int messageCount;

        /** ms */
        private long updatedAt;
    }
}
