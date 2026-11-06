-- =============================================================================
-- 010_knowledge_v0.3_migration.sql · 知识库 v0.2 → v0.3 增量迁移
-- -----------------------------------------------------------------------------
-- 适用：已按 009_knowledge.sql（v0.2）建过表的库（个人服务器 docker 容器）。
-- 变更：① 新增 embedding_model 列；② 向量索引 HNSW/余弦 → IVFFlat/L2。
-- 幂等：ADD COLUMN IF NOT EXISTS / DROP INDEX IF EXISTS / CREATE INDEX IF NOT EXISTS。
-- 注意：IVFFlat 索引需表内已有向量数据才能正常构建；若表为空，先向量化至少一篇文档再建索引。
-- =============================================================================

ALTER TABLE knowledge_embedding
    ADD COLUMN IF NOT EXISTS embedding_model VARCHAR(100) NOT NULL
        DEFAULT 'qwen3.7-text-embedding-flash';

COMMENT ON COLUMN knowledge_embedding.embedding_model IS '生成向量的模型标识；检索时强制一致，禁止不同模型向量混查';

DROP INDEX IF EXISTS idx_knowledge_embedding_vec;

CREATE INDEX IF NOT EXISTS idx_knowledge_embedding_doc_model
    ON knowledge_embedding (doc_id, embedding_model);

CREATE INDEX IF NOT EXISTS idx_knowledge_embedding_vec
    ON knowledge_embedding USING ivfflat (embedding vector_l2_ops) WITH (lists = 100);
