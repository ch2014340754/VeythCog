-- =============================================================================
-- 011_knowledge_remove_libtype.sql · 清理历史 lib_type 列
-- -----------------------------------------------------------------------------
-- 背景：v0.1/v0.2 曾用 lib_type（private / demo）做「私有库 / 演示库」物理隔离。
--       该概念已于 2026-11-09 废弃：代码不再读写该列，文档按账号共享，
--       用户级赋权由后续统一中间件承担。
--
-- 适用：执行过 009 的库（含曾执行过旧版 011 的库）。
-- 变更：物理删除 knowledge_doc.lib_type 及其注释、旧组合索引，改留 deleted 单列索引。
-- 幂等：可重复执行（DROP ... IF EXISTS）。
--
-- ⚠️ 不可逆：删除后该列的 'private' / 'demo' 历史取值随列一并丢弃。这些值已无业务语义
--    （全部等同 private），不影响任何读写路径；如需保留取证，请先在库外备份：
--      psql -c "\copy (SELECT id, lib_type FROM knowledge_doc) TO 'lib_type_backup.csv' CSV HEADER"
-- =============================================================================

ALTER TABLE knowledge_doc DROP COLUMN IF EXISTS lib_type;

DROP INDEX IF EXISTS idx_knowledge_doc_lib_deleted;

-- 列表页现按 deleted 过滤，补一个单列索引（新库由 009 直接建出，此处兼容旧库）
CREATE INDEX IF NOT EXISTS idx_knowledge_doc_deleted
    ON knowledge_doc (deleted);
