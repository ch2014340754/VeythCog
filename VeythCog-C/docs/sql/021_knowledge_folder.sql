-- =============================================================================
-- 021_knowledge_folder.sql · 知识库文件夹（目录树）
-- -----------------------------------------------------------------------------
-- 环境：PostgreSQL 16 + pgvector（个人服务器 docker 容器）
-- 内容：新增 knowledge_folder 目录表（自引用 parent_id）+ knowledge_doc.folder_id 归属列
-- 幂等：本脚本可重复执行（IF NOT EXISTS / 部分唯一索引）
-- 存量：knowledge_doc.folder_id 为 NULL 即根级，无需回填数据
-- -----------------------------------------------------------------------------
-- ⚠️ 执行顺序：009 → 010 → 011 → 021
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. 目录表 knowledge_folder
--    自引用树：parent_id NULL = 根级；软删除与 knowledge_doc 保持一致
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS knowledge_folder (
    id          BIGSERIAL     PRIMARY KEY,
    parent_id   BIGINT        NULL REFERENCES knowledge_folder(id),
    name        VARCHAR(100)  NOT NULL,
    sort_order  INT           NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    deleted     BOOLEAN       NOT NULL DEFAULT false
);

COMMENT ON TABLE  knowledge_folder           IS '知识库目录表（自引用树，软删除）';
COMMENT ON COLUMN knowledge_folder.parent_id IS '父目录 id；NULL = 根级';
COMMENT ON COLUMN knowledge_folder.sort_order IS '同级排序序号（预留手动排序，当前恒为 0，前端按名称排序）';
COMMENT ON COLUMN knowledge_folder.deleted   IS '软删除标记；删除目录时由应用层递归软删子目录与文档';

-- -----------------------------------------------------------------------------
-- 2. 文档归属列 knowledge_doc.folder_id
-- -----------------------------------------------------------------------------
ALTER TABLE knowledge_doc
    ADD COLUMN IF NOT EXISTS folder_id BIGINT NULL REFERENCES knowledge_folder(id);

COMMENT ON COLUMN knowledge_doc.folder_id IS '所属目录 id；NULL = 根级';

-- -----------------------------------------------------------------------------
-- 3. 索引
-- -----------------------------------------------------------------------------
-- 树查询：按父节点取子目录
CREATE INDEX IF NOT EXISTS idx_knowledge_folder_parent
    ON knowledge_folder (parent_id, deleted);

-- 文档按目录取列表 / 统计
CREATE INDEX IF NOT EXISTS idx_knowledge_doc_folder
    ON knowledge_doc (folder_id, deleted);

-- 同级目录不重名（含根级；软删除后可复用同名）
-- PostgreSQL 唯一索引不把 NULL 视为相等，根级用 COALESCE(parent_id, 0) 兜底
CREATE UNIQUE INDEX IF NOT EXISTS uk_knowledge_folder_sibling_name
    ON knowledge_folder (COALESCE(parent_id, 0), name)
    WHERE deleted = false;
