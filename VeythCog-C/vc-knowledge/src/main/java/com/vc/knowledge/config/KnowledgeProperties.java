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
        private double distanceThreshold = 0.8;
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
}
