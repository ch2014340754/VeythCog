# Spec 变更记录（change-log.md）

> 用途：记录「什么时候改了哪个接口/表/文档」，作为所有协作 Agent 的变更通知源。任何 Agent 修改 spec/接口/表后，必须在此追加一条，并同步 `PROJECT_MEMORY.md` 与 `current-tasks.md`。
> 记录格式：`日期 | 类型 | 变更内容 | 影响文件/表/接口 | 通知对象`。类型：🆕新增 / ✏️修改 / ⚠️兼容 / 🔧修复 / 📄文档。

## 变更记录

| 日期 | 类型 | 变更内容 | 影响文件/表/接口 | 通知对象 |
|---|---|---|---|---|
| 2026-11-06 | 📄 | 知识库 PRD 评审并优化至 v0.2 | `openspec/knowledge-prd.md`（取代 `openspec/changes/p0/知识库设计PRD.md` v0.1） | 全体 Agent |
| 2026-11-06 | 🆕 | 新增知识库 API 契约 | `openspec/api-spec.md`（10 个接口 + DTO + 错误码 + 权限矩阵） | 前后端 Agent |
| 2026-11-06 | 🆕 | 新增知识库建表脚本 | `openspec/sql/knowledge-init.sql`（`knowledge_doc`/`knowledge_embedding` + 索引 + pgvector 扩展） | 后端 Agent |
| 2026-11-06 | 🆕 | 建立 `.ai-context/` AI 协作文档目录 | `.ai-context/global-rule.md`、`current-tasks.md`、`change-log.md` | 全体 Agent |

## 关键 spec 变更明细（v0.1 → v0.2，需全体 Agent 知悉）

| 变更点 | 旧（v0.1） | 新（v0.2） | 影响 |
|---|---|---|---|
| ✏️ 向量维度 | `vector(1536)` | `vector(1024)` | `knowledge_embedding.embedding` 列；与 `spring.ai.dashscope.embedding.options.dimensions` 对齐 |
| ✏️ 中文检索 | `to_tsvector('english', ...)` | `to_tsvector('simple', ...)` | `idx_knowledge_doc_text_gin` 索引 |
| ✏️ 软删除语义 | 软删除 + `ON DELETE CASCADE`（矛盾） | 软删除 + 接口显式清理 embedding | `DELETE /api/knowledge/doc/{docId}` 实现 |
| 🆕 向量索引 | 无 | HNSW `vector_cosine_ops` | `idx_knowledge_embedding_vec` |
| 🆕 摘要列 | 无 | `summary VARCHAR(500)` | `knowledge_doc` 表、列表页 |
| 🆕 访客机制 | 未定义 | SecurityConfig 放行 `GET /api/knowledge/demo/**` + 写接口 403 | `SecurityConfig`、权限矩阵 |
| 🆕 双存储权威源 | 未明确 | `block_data` 权威、`markdown_text` 派生 | 保存/导入逻辑 |
| 🆕 分块参数 | 未写死 | `512`/`64`/`top5` 常量 | 向量化/RAG 接口 |

## 环境事实核查结果（2026-11-06 用户确认，已解除 KB-03 阻塞）

- [x] Embedding 模型与维度：保持 `qwen3.7-text-embedding-flash` + `1024`（与 `vector(1024)` 一致）
- [x] pgvector 扩展：目标库已迁移到个人服务器 docker 容器，已启用 `CREATE EXTENSION vector`
- [x] 数据库连接：实际 datasource 为个人服务器 docker 容器（pgvector/pgvector:pg16），非 Supabase 云端
