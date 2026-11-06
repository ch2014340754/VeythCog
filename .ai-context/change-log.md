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
| 2026-11-06 | 🆕 | 按契约落地知识库后端（实体/Repository/CRUD/导入导出/向量化/RAG/权限） | `vc-knowledge/pom.xml`、`entity/KnowledgeDoc.java`、`repository/*`、`service/*`、`vc-app/.../web/KnowledgeController.java`、`config/SecurityConfig.java`、`application.yml`（embedding 配置）、`docs/sql/009_knowledge.sql` | 后端 Agent |
| 2026-11-06 | 🔧 | 修复 `vc-knowledge` 缺 `spring-boot-starter-validation` 导致的编译失败 | `vc-knowledge/pom.xml` | 后端 Agent |
| 2026-11-06 | 🆕 | 落地知识库前端（列表/编辑器/导入导出/向量化 + 对话侧 RAG 抽屉与引用卡片） | `VeythCog-V/src/api/knowledge.ts`、`types/index.ts`、`pages/Knowledge/index.tsx`、`pages/Chat/index.tsx` | 前端 Agent |
| 2026-11-06 | 📄 | 同步 `PROJECT_MEMORY.md`（§3/§4/§5/§6/§10）与 `current-tasks.md` 状态 | `PROJECT_MEMORY.md`、`.ai-context/current-tasks.md` | 全体 Agent |
| 2026-11-06 | ✏️ | 知识库 DB 层 JPA+JdbcTemplate → MyBatis-Plus（实体/Mapper/XML/TypeHandler/分页插件） | `vc-knowledge`（entity/mapper/handler/config/service）、`vc-app/VcAppApplication.java`、`application.yml`、根 `pom.xml` | 后端 Agent |
| 2026-11-06 | ✏️ | 切片改用自定义 `RecursiveCharacterTextSplitter`（不依赖 Alibaba，优先保留代码块） | `vc-knowledge/.../splitter/RecursiveCharacterTextSplitter.java` | 后端 Agent |
| 2026-11-06 | 🆕 | 抽象 `EmbeddingProvider`（DashScope 实现，支持后续切换本地服务） | `vc-knowledge/.../embedding/EmbeddingProvider.java`、`DashScopeEmbeddingProvider.java` | 后端 Agent |
| 2026-11-06 | ✏️ | 检索改 L2 `<->` + distance 阈值 + 限定勾选 docIds + `embedding_model` 校验 + 软删除过滤 | `KnowledgeEmbeddingMapper.xml`、`VectorizeServiceImpl.java` | 前后端 Agent |
| 2026-11-06 | ✏️ | 向量索引 HNSW/余弦 → IVFFlat/L2；`knowledge_embedding` 新增 `embedding_model` 列 | `openspec/sql/knowledge-init.sql`、`docs/sql/009_knowledge.sql` | 后端 Agent |
| 2026-11-06 | ✏️ | RAG 返回增加 `chunkIndex`；前端引用卡片改显示「分片# + 距离」 | `RetrieveChunk.java`、`VeythCog-V/src/types/index.ts`、`pages/Chat/index.tsx` | 前后端 Agent |
| 2026-11-06 | 📄 | 同步 PRD/API 契约/PROJECT_MEMORY/协作文档至 v0.3 | `openspec/knowledge-prd.md`、`openspec/api-spec.md`、`PROJECT_MEMORY.md` | 全体 Agent |

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

## 关键 spec 变更明细（v0.2 → v0.3，需全体 Agent 知悉）

| 变更点 | 旧（v0.2） | 新（v0.3） | 影响 |
|---|---|---|---|
| ✏️ 向量索引 | HNSW `vector_cosine_ops` | IVFFlat `vector_l2_ops`（lists=100） | `idx_knowledge_embedding_vec`；检索距离语义从余弦改 L2 |
| 🆕 模型标识 | 无 | `embedding_model VARCHAR(100)` | `knowledge_embedding` 表；写入与检索均强制一致，禁止混查 |
| ✏️ 检索距离 | `<=>` 余弦 | `<->` L2 + `distance` 阈值 | `POST /knowledge/rag/retrieve`；返回 `score` 语义为 L2 距离 |
| ✏️ 切片 | 固定字符切片 | 自定义 `RecursiveCharacterTextSplitter`（分隔符优先级 + 代码块保护） | 向量化流程 |
| ✏️ DB 层 | JPA + JdbcTemplate | MyBatis-Plus（LambdaWrapper + XML） | `vc-knowledge` 全模块 |
| ✏️ 返回字段 | `chunkText/docId/title/score` | 增加 `chunkIndex` | `RetrieveChunk`、前端引用卡片 |
