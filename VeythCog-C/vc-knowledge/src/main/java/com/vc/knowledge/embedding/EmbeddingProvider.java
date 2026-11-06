package com.vc.knowledge.embedding;

import java.util.List;

/**
 * Embedding 能力抽象：屏蔽具体供应商/本地服务差异，支持后续切换本地 Embedding 服务。
 */
public interface EmbeddingProvider {

    /** 当前 provider 的模型标识（写入 knowledge_embedding.embedding_model，用于禁止混查） */
    String modelId();

    /** 单条文本向量化 */
    float[] embed(String text);

    /** 批量向量化（内部可分批，避免单次超限） */
    List<float[]> embedBatch(List<String> texts);
}
