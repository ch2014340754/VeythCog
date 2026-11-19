package com.vc.knowledge.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * 知识库配置（knowledge.*）。
 */
@Data
@Component
@ConfigurationProperties(prefix = "knowledge")
public class KnowledgeProperties {

    private Chunk chunk = new Chunk();
    private Retrieve retrieve = new Retrieve();
    private Embedding embedding = new Embedding();
    private Graph graph = new Graph();

    @Data
    public static class Chunk {
        /** 切片大小（字符） */
        private int size = 512;
        /** 切片重叠（字符） */
        private int overlap = 64;
    }

    @Data
    public static class Retrieve {
        /** 默认召回条数 */
        private int topN = 5;
        /** L2 距离阈值，超过该距离的片段被过滤（需按实际向量分布核查） */
        private double distanceThreshold = 1.2;
        /** 检索结果 rerank（用 llm.aux-model 指定的小模型重排） */
        private Rerank rerank = new Rerank();
    }

    @Data
    public static class Rerank {
        /** 是否启用 rerank */
        private boolean enabled = true;
        /** 送入 rerank 的候选条数（最终仍只保留 topN） */
        private int candidates = 10;
        /** 每个候选片段送入提示词的最大字符数 */
        private int maxChunkChars = 400;
    }

    @Data
    public static class Embedding {
        /** 模型标识，必须与 spring.ai.dashscope.embedding.options.model 一致 */
        private String modelId = "qwen3.7-text-embedding-flash";
        /** 向量维度，必须与 pgvector vector(1024) 一致 */
        private int dimensions = 1024;
        /** 批量 embedding 每批条数 */
        private int batchSize = 10;
    }

    /**
     * 知识地图（knowledge.graph.*）：阈值与规模必须可配，不要写死在代码里。
     */
    @Data
    public static class Graph {
        /** 每个节点保留的近邻数 top-k */
        private int k = 5;
        /** 最低相似度（0-1，sim = 1 - L2/2），需用真实数据校准 */
        private double minSimilarity = 0.55;
        /** 节点上限，超过按一级目录聚合 */
        private int maxNodes = 300;
        /** 节点硬上限（接口 maxNodes 参数不得超过） */
        private int hardMaxNodes = 500;
        /** 结果缓存 TTL（秒） */
        private int cacheTtlSeconds = 600;
        /** 单次计算超时（毫秒），超时降级 */
        private int timeoutMs = 3000;
        /** 指定 embedding 模型；留空 = 自动取主导模型 */
        private String model = "";
        /** 质心算法：mean（均值）/ medoid（离均值最近的真实分片） */
        private String centroidMode = "mean";
    }
}
