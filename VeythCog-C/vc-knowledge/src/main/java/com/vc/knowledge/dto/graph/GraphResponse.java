package com.vc.knowledge.dto.graph;

import lombok.Data;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

/**
 * 知识地图返回结构（GET /knowledge/graph）。
 *
 * <p>后端只给结构（节点 / 边 / 簇 / 孤岛 / 元信息），坐标由前端力导向布局计算。</p>
 */
@Data
public class GraphResponse implements Serializable {

    /** 可建图节点（已向量化文档；超限时是目录簇节点，id 为负数） */
    private List<GraphNode> nodes = new ArrayList<>();

    private List<GraphEdge> edges = new ArrayList<>();

    private List<GraphCluster> clusters = new ArrayList<>();

    private Islands islands = new Islands();

    private GraphMeta meta = new GraphMeta();

    @Data
    public static class GraphNode implements Serializable {

        /** docId；簇节点为 -folderId（负数，前端据此区分） */
        private Long id;

        private String title;

        private Long folderId;

        /** "技术/中间件"；根级 "/" */
        private String folderPath;

        /** 分片数（节点大小依据） */
        private int chunkCount;

        /** markdown_text 字符数 */
        private int charCount;

        /** 恒 true（未向量化在 islands 里） */
        private boolean vectorized;

        /** 连接数 */
        private int degree;

        private int clusterId;

        /** 0-7，前端调色板索引，由目录稳定哈希得出 */
        private int colorKey;
    }

    @Data
    public static class GraphEdge implements Serializable {

        private Long source;

        private Long target;

        /** 0-1，保留 3 位 */
        private double similarity;

        /** 共同标签，可为空 */
        private List<String> sharedTags = new ArrayList<>();
    }

    @Data
    public static class GraphCluster implements Serializable {

        private int id;

        private String label;

        private int size;

        private Long folderId;

        private int colorKey;
    }

    @Data
    public static class Islands implements Serializable {

        /** degree=0 的已向量化文档 id */
        private List<Long> isolated = new ArrayList<>();

        /** 未向量化文档（灰点），不参与建边 */
        private List<GraphNode> unvectorized = new ArrayList<>();
    }

    @Data
    public static class GraphMeta implements Serializable {

        /** 本次计算使用的 embedding 模型；无向量时为 null */
        private String model;

        /** 库内未删除文档总数 */
        private int docCount;

        private int nodeCount;

        private int edgeCount;

        /** 是否发生目录簇聚合（或计算降级） */
        private boolean degraded;

        private int maxNodes;

        /** ms；缓存命中时为上次计算时间 */
        private long computedAt;

        /** 本次计算耗时（缓存命中为 0） */
        private long elapsedMs;
    }
}
