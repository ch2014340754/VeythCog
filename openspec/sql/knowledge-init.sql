# ⚠️ 本文件已废弃（2026-11-09）

知识库建表/迁移脚本的唯一权威版本已迁至后端仓库：

```
VeythCog-C/docs/sql/009_knowledge.sql                     # 建表（knowledge_doc + knowledge_embedding + 索引）
VeythCog-C/docs/sql/010_knowledge_v0.3_migration.sql      # 补 embedding_model 列 + IVFFlat 索引
VeythCog-C/docs/sql/011_knowledge_remove_libtype.sql      # 物理删除历史 lib_type 列（幂等，DROP COLUMN IF EXISTS）
```

按 **009 → 010 → 011** 顺序执行。新库：009 已不再建 `lib_type`，011 为空操作；旧库：011 删除该列。个人服务器库已完成 009/010，**011 需按新版重新执行一次以真正删列**。

本文件保留仅为兼容旧链接，不再维护，也不再作为落地依据。原内容（v0.3：`lib_type`、`private/demo` 物理隔离、访客只读）与当前代码不符，请勿执行。

当前数据模型摘要（以 `VeythCog-C/docs/sql/*.sql` 为准）：

| 表 | 关键点 |
|---|---|
| `knowledge_doc` | `block_data` JSONB 权威源 + `markdown_text` 派生缓存；`tags text[]`；`summary ≤500`；`deleted` 软删除；**无 `lib_type`**（已由 011 删除） |
| `knowledge_embedding` | `embedding vector(1024)` + `embedding_model`（禁止跨模型混查）；`(doc_id, chunk_index)` 唯一；`doc_id` 外键，软删除时由接口显式清理 |
| 索引 | `to_tsvector('simple', ...)` GIN 关键词索引；`(doc_id, embedding_model)` 复合索引；IVFFlat `vector_l2_ops`（`lists=100`，小数据量收益存疑） |

对应代码：`com.vc.knowledge.entity.KnowledgeDoc` / `KnowledgeEmbedding`，Mapper XML 见 `vc-knowledge/src/main/resources/mapper/`。
