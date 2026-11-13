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
| 2026-11-12 | 🆕 | 导航书签图标资产化：站点图标 / 自定义图标统一存 S3 `public-icons`，前端缓存优先 + DB 解析 | `openspec/changes/p2-nav-icons/*`、`docs/sql/013_nav_bookmark_icon.sql`、`vc-nav`（entity/dto/service）、`vc-app/web/NavIconController.java`、`VeythCog-V`（client/nav/iconCache/BookmarkModal/BookmarkIcon/Home） | 全体 Agent |
| 2026-11-13 | 🆕 | 用户自持加密 Key：AES-256-GCM 入库（`user_llm_binding.api_key_cipher` / `api_key_updated_at`）、供应商多选批量绑定、AK 编辑/清除、用户 Key 优先 + 配置 AK 兜底、缓存按 Key 指纹隔离、DashScope 动态实例 | `openspec/changes/p0-user-llm-key/*`、`docs/sql/015_user_llm_binding_api_key.sql`、`vc-llm`（crypto/config/entity/service/router/factory/dto）、`vc-app`（LlmModelController/BatchBindRequest/ApiKeyRequest/GlobalExceptionHandler/application.yml）、`VeythCog-V`（api/llm.ts、types、Settings/Providers.tsx） | 前后端 Agent |
| 2026-11-13 | 🔧 | `@Valid` 参数校验失败改回 `{code:40000,message}` 契约（空 message / 空账号密码不再返回 Spring 默认错误体） | `vc-app/web/GlobalExceptionHandler.java` | 前后端 Agent |
| 2026-11-13 | ✏️ | `GET /llm/models` 按绑定创建时间升序（补 spec 排序要求） | `vc-llm/repository/UserLlmBindingRepository.java`、`LlmModelService.java` | 前端 Agent |
| 2026-11-13 | 🆕 | 模型目录管理：`/admin/llm-models` 增删改查 + 上下架 + 从供应商同步（百炼按 TG 过滤、只增不删、新增默认不上架、有绑定禁止删除/改编码） | `openspec/changes/llm-model-catalog-admin/*`、`vc-llm/service/LlmCatalogAdminService.java`、`vc-llm/dto/{AdminModelItem,ModelSyncResult}.java`、`vc-app/web/{AdminLlmModelController,AdminModelSaveRequest,AdminModelEnabledRequest,AdminModelSyncRequest}.java`、`LlmModelRepository`、`UserLlmBindingRepository` | 前后端 Agent |
| 2026-11-13 | ✏️ | 前端系统管理「模型目录」由 mock 改为真实接口（表格/筛选/新增/编辑/删除/上下架/同步，静默刷新） | `VeythCog-V/src/api/adminModels.ts`、`src/pages/Admin/Models.tsx` | 前端 Agent |
| 2026-11-12 | ✏️ | 导航图标接口端到端验证：18 条历史书签同步成功 13 条；5 条因站点/网络原因保留 1 天失败冷却 | `openspec/changes/p2-nav-icons/tasks.md`、`design.md §7` | 前后端 Agent |

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

## 2026-11-12 iTab 备份导入（NAV-06）

- 来源：`iTab备份-2026.json`（106209 字节，iTab 官方导出；存在非法尾逗号，已用正则容错解析）。
- 计划 256 条：239 条图片图标 + 17 条文字图标；跳过 5 个组件、8 个 `itab://add` 占位、4 个非 http(s) 图标、备份内 15 条重复。
- 最终 `nav_bookmark` 267 条：新建 249 条（其中 1 条 VeythCog 重复项已合并删除）、已有书签更新图标 8 条；分类分布 主页28/后端28/前端60/学习32/工具47/游戏26/AI46。
- 图标：upload 238、text 18、auto 11；S3 `public-icons` 245 个唯一对象被引用、247 条书签引用，逐条 HEAD 全部 200（png/x-icon/jpeg 与扩展名一致）。
- 半图修复：70 个 SVG 图标原本只有上半张，根因是 Windows 高 DPI 下 Chrome 无头截图 CSS 视口只有窗口一半；转换器改为 2 倍窗口 + alpha 包围盒裁剪 + `--headless=new` 超时回退旧 `--headless`，68 个脚本重刷 + 2 个手工补齐（VeythCog id18、Stack Overflow id11），抽查与全量 HEAD 通过。
- 首页书签容器由 `maxWidth:900 + margin:0 auto` 改为 `width:66.6667vw + margin:0 auto`，书签区占视口约三分之二。
- 入库脚本整理：`import_itab_backup.py` 支持 `--token` / `--chrome` / `--work-dir`；`--dry-run` 不再创建分类；`README-nav-import.md` 补线上同步、数据库备份与独立 work-dir 规范。
- 失败恢复：Stack Overflow（旧 `--headless` 渲染）、技术文章摘抄（延长超时）、激战2中文维基（URL 空格编码）已补上传；莫娜占卜铺连接被重置，保留文字图标。
- 脚本 `VeythCog-C/scripts/import_itab_backup.py` 修复 `make_upload_asset` 返回值解包 bug，避免图片被误判失败；导入前备份 `nav-backup.json` 保留可回滚。
- 首次误跑生成的 21–53 共 33 条文字副本已物理删除，数据库恢复后重跑。
- 图标缓存修复：`BookmarkIcon` 命中 `localStorage` 描述缓存后未提前返回，仍会请求 `/nav/bookmarks/{id}/icon`；已改为缓存命中直接渲染，切换分类不再重复请求，只有首次或图标字段变化才查后端。`tsc --noEmit` 通过。
- 新增 `docs/sql/014_nav_itab_data.sql`：7 分类 + 267 书签的纯 SQL 入库脚本（含图标字段），首次按 `(user_id,name)` / `(category_id,url)` 插入，已有同 URL 书签同步 4 个图标字段；隔离 schema 实测首次 7/267、二次仍 7/267，清空图标后可补回。说明见 `docs/sql/README-014-nav-data.md`。