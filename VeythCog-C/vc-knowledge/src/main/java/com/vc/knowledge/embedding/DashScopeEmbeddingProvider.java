package com.vc.knowledge.embedding;

import com.vc.knowledge.config.KnowledgeProperties;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * 阿里百炼（DashScope）Embedding 实现，包装 Spring AI EmbeddingModel。
 * 模型标识取自 knowledge.embedding.model-id，需与 spring.ai.dashscope.embedding.options.model 保持一致。
 */
@Component
public class DashScopeEmbeddingProvider implements EmbeddingProvider {

    private final EmbeddingModel embeddingModel;
    private final KnowledgeProperties properties;

    public DashScopeEmbeddingProvider(EmbeddingModel embeddingModel, KnowledgeProperties properties) {
        this.embeddingModel = embeddingModel;
        this.properties = properties;
    }

    @Override
    public String modelId() {
        return properties.getEmbedding().getModelId();
    }

    @Override
    public float[] embed(String text) {
        return embeddingModel.embed(text);
    }

    @Override
    public List<float[]> embedBatch(List<String> texts) {
        int batchSize = Math.max(1, properties.getEmbedding().getBatchSize());
        List<float[]> result = new ArrayList<>();
        for (int i = 0; i < texts.size(); i += batchSize) {
            List<String> batch = texts.subList(i, Math.min(i + batchSize, texts.size()));
            result.addAll(embeddingModel.embed(batch));
        }
        return result;
    }
}
