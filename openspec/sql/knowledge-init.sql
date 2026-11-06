-- =============================================================================
-- knowledge-init.sql  ·  知识库模块初始化脚本（P0）
-- -----------------------------------------------------------------------------
-- 环境：PostgreSQL 16 + pgvector（个人服务器 docker 容器，pgvector/pgvector:pg16）
-- 前置：目标库必须已启用 pgvector 扩展（见文末 CREATE EXTENSION）。
--       若扩展未启用，knowledge_embedding 表可建但向量写入会失败。
-- 版本：v0.2-P0（相对 PRD v0.1 的修正见 change-log.md）
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. 启用 pgvector 扩展（幂等）
--    注意：目标库（个人服务器 docker 容器）已启用该扩展；pgvector/pgvector:pg16 镜像自带。
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS vector;

-- -----------------------------------------------------------------------------
-- 1. 文档主表 knowledge_doc
--    双存储：block_data(JSONB，权威源) + markdown_text(TEXT，派生缓存，供检索/导出)
--    软删除：deleted 标记；P0 不物理删除主表行，embedding 由接口显式级联清理。
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS knowledge_doc (
    id             BIGSERIAL PRIMARY KEY,
    lib_type       VARCHAR(20)  NOT NULL,                  -- private / demo（物理隔离）
    title          VARCHAR(255) NOT NULL,
    summary        VARCHAR(500) NOT NULL DEFAULT '',       -- 列表页摘要（v0.2 新增）
    tags           TEXT[]       NOT NULL DEFAULT '{}',     -- 标签数组，预留批量打标签
    block_data     JSONB        NOT NULL DEFAULT '[]'::jsonb, -- 块结构数组（权威源）
    markdown_text  TEXT         NOT NULL DEFAULT '',       -- 同步生成的标准 md（派生缓存）
    is_vectorized  BOOLEAN      NOT NULL DEFAULT false,    -- 是否已向量化（手动触发）
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    deleted        BOOLEAN      NOT NULL DEFAULT false     -- 软删除，预留回收站/恢复
    -- 【扩展预留】owner_id BIGINT REFERENCES app_user(id)  -- 多用户时补，P0 单用户不建
);

COMMENT ON TABLE  knowledge_doc IS '知识库文档主表（块 JSON + Markdown 双存储）';
COMMENT ON COLUMN knowledge_doc.lib_type      IS '库类型：private=私有库 / demo=演示库（数据与向量物理隔离）';
COMMENT ON COLUMN knowledge_doc.block_data    IS '块结构数组，权威源；markdown_text 为其派生缓存';
COMMENT ON COLUMN knowledge_doc.markdown_text IS '标准 Markdown，供关键词检索 / 导出 / RAG 切片';
COMMENT ON COLUMN knowledge_doc.is_vectorized IS '是否已向量化；保存文档不自动置 true，由用户手动触发';
COMMENT ON COLUMN knowledge_doc.deleted       IS '软删除标记；删除时同步显式清理 embedding（FK 级联不触发）';

-- -----------------------------------------------------------------------------
-- 2. 向量分片表 knowledge_embedding（pgvector）
--    维度 1024：与 spring.ai.dashscope.embedding.options.dimensions 严格一致。
--    换模型/换维度必须迁移本列，禁止在代码里散落硬编码维度。
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS knowledge_embedding (
    id           BIGSERIAL PRIMARY KEY,
    doc_id       BIGINT       NOT NULL REFERENCES knowledge_doc(id) ON DELETE CASCADE,
    chunk_index  INT          NOT NULL,                    -- 文档内分片序号（从 0 起）
    chunk_text   TEXT         NOT NULL,                    -- 分片原文（用于溯源/展示）
    embedding    vector(1024) NOT NULL,                    -- 向量，维度=1024（v0.2 修正）
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (doc_id, chunk_index)                           -- 幂等键：同一文档同一分片唯一
);

COMMENT ON TABLE  knowledge_embedding IS '文档向量分片表（pgvector）';
COMMENT ON COLUMN knowledge_embedding.embedding   IS '向量，维度 1024，与 qwen3.7-text-embedding-flash 一致';
COMMENT ON COLUMN knowledge_embedding.chunk_index IS '分片序号；向量化接口以 (doc_id) 为幂等键先删后插';

-- -----------------------------------------------------------------------------
-- 3. 索引
-- -----------------------------------------------------------------------------
-- 列表页：库类型 + 软删除过滤（最常用组合）
CREATE INDEX IF NOT EXISTS idx_knowledge_doc_lib_deleted
    ON knowledge_doc (lib_type, deleted);

-- 关键词检索：中文内容用 'simple' 配置（v0.2 修正，原 'english' 对中文不切词）。
-- 若需更强中文分词，可后续引入 zhparser/jieba 扩展，P0 不引入。
CREATE INDEX IF NOT EXISTS idx_knowledge_doc_text_gin
    ON knowledge_doc USING gin (
        to_tsvector('simple',
            title || ' ' || coalesce(summary, '') || ' ' || coalesce(markdown_text, ''))
    );

-- 文档级向量清理（软删除路径显式按 doc_id 删）
CREATE INDEX IF NOT EXISTS idx_knowledge_embedding_doc
    ON knowledge_embedding (doc_id);

-- 向量相似度检索索引：HNSW + 余弦距离（v0.2 新增；小数据集 HNSW 比 IVFFlat 省心）
CREATE INDEX IF NOT EXISTS idx_knowledge_embedding_vec
    ON knowledge_embedding USING hnsw (embedding vector_cosine_ops);

-- -----------------------------------------------------------------------------
-- 4. 分块/检索参数常量（与 docs/architecture.md 对齐，代码与文档统一）
--    CHUNK_SIZE=512（字符）  CHUNK_OVERLAP=64（字符）  TOP_K=5
--    建议在代码中以常量类承载，避免散落魔法值。
-- -----------------------------------------------------------------------------
