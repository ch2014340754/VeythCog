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
| 2026-11-13 | ✏️ | 前端系统管理「模型目录」由 mock 改为真实接口（表格/筛选/新增/编辑/删除/上下架/同步，静默刷新）；列表撑满父容器、取消分页改内部滚动、新增关键字搜索 | `VeythCog-V/src/api/adminModels.ts`、`src/pages/Admin/Models.tsx` | 前端 Agent |
| 2026-11-12 | ✏️ | 导航图标接口端到端验证：18 条历史书签同步成功 13 条；5 条因站点/网络原因保留 1 天失败冷却 | `openspec/changes/p2-nav-icons/tasks.md`、`design.md §7` | 前后端 Agent |
| 2026-11-14 | 📄 | 新增前端视觉规范（颜色三层 / 令牌 / 玻璃配方 / 排版 / 动效 / 暗色清单 / 新页面 checklist / 反模式）；登录页定为视觉基准并完成改版（玻璃卡 + 漂移光斑 + 指针视差 + 方位渐变描边） | `VeythCog-V/docs/frontend-style-guide.md`（新）、`VeythCog-V/src/pages/Login/{index.tsx,login.css}`、`PROJECT_MEMORY.md §13`、`.ai-context/global-rule.md §9` | 全体 Agent（尤其前端） |

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
## 2026-11-13 系统监控（vc-admin + 可观测性）

- 新增后端模块 `vc-admin`（`com.vc.admin`）：依赖 `vc-common` / `vc-llm`，被 `vc-app` 装配；**不反向依赖 vc-app**，因此用户/角色管理仍留 `vc-app`。
- 新增 `docs/sql/016_observability.sql` 四表：`sys_api_sample`（单请求明细）、`sys_api_metric_minute`（分钟桶 + 6 档耗时直方图，唯一键 `(bucket,method,route)`）、`llm_call_log`、`sys_user_session`（sid 主键，status active/kicked/logout/expired）。开发库执行输出 `OK executed=19`。
- 采集：`ApiAccessLogFilter` 重写为采集型过滤器（归一化路由 `BEST_MATCHING_PATTERN`、业务码、耗时、流式标记，`/api/admin/monitor` 自身不打点，搜索词不落库）；`MetricsCollector` 队列 + 2s 批量落库；`BizCodeAdvice` 把 `BaseResponse.code` 写入请求属性（后端业务错误是 HTTP 200，否则错误率恒 0）。
- LLM 用量：`vc-llm` 新增 SPI `LlmCallRecorder` / `LlmCallRecord`；`LlmModelRouter` 改 `.chatResponse()` 捕获 usage、流式取最后 chunk，缺失按字符估算（CJK 1 字 1 token、其他 4 字符 1 token）并标 `usage_source`。
- 会话：登录建 `sys_user_session`，JWT 增 `sid`；`JwtAuthFilter` 校验会话，踢人/登出后 token 立即 401；新增 `POST /auth/logout`。**旧 token 无 sid 失效，需重新登录**。
- 查询/资源：`MonitorQueryService`（overview/timeseries/endpoints/errors/llm/sessions，Asia/Shanghai 分桶）、`ResourceMonitor`（JDK MXBean 采 CPU/内存/Swap/JVM/线程/磁盘，缺失 -1）、`MonitorRetentionJob`（每日 03:30 清理）。接口：`/admin/monitor/{overview,timeseries,endpoints,errors,llm,sessions,sessions/{sid}/kick,resources,status}`。
- 前端：`types/index.ts` 增监控类型；`api/admin.ts` 监控段由 mock 改 `/admin/monitor/*`（bypass 模式仍返本地假数据）；`Admin/Monitoring.tsx` 重写为概览卡 + 调用趋势 + 服务资源 + 接口排行 + LLM 用量 + 在线会话（强制下线）+ 最近错误，60s 静默刷新。`npm run build` 通过。
- 验证（8125 临时实例）：overview 统计到 `/auth/login`（calls=1、p95=479ms）；资源接口真实值；`chat/message` 上游 403 → errors 记录 bizCode=50000、HTTP 200、message 原文、rid；llm 记录 1 次失败调用、promptTokens 估算 1、latency 723ms；按 JWT sid 精确踢人后 token2 40100、token1 正常；logout 后原 token 40100。
## 2026-11-13 P0 收口（连通校验 / chat_session / 上下文压缩）

- `docs/sql/017_p0_verify_and_session.sql`：`user_llm_binding` 增 `is_valid` / `last_verify_at` / `verify_error`；新建 `chat_session`（unique(user_id, conversation_id)，含标题 / vendor+model / rag_doc_ids / enable_context_compress / deleted）。开发库 `OK executed=12`。
- 连通校验：`LlmBindingVerifier` + `POST /llm/bindings/{vendor}/{modelCode}/verify`。真实最小请求探测，失败按 401/403 额度/404/429/超时翻译成用户可判断的原因；成功置 `is_valid=true`，失败写 `is_valid=false + verify_error`。`LlmModelRouter` 对话路径要求 `is_valid=true`（`probe` 单独放行），新增/换/清 AK 自动重置校验状态；`/llm/models` 与目录 `valid` 只暴露已校验绑定。
- 会话级配置：`ChatSessionService` + JPA `ChatSession`；新增 `/chat/sessions` 增删改查。`/chat/message`、`/chat/stream` 先 `resolveForSend`，模型/`docIds`/压缩开关以会话为准；`/chat/conversations` 合并会话配置（未发消息的新会话也返回），重命名/文档范围/压缩开关刷新不丢。
- 上下文压缩：`ContextCompressor` + `chat.compress.*`（thresholdTokens=4000、keepRounds=3、summaryInputMaxChars=8000）。超阈值把最早历史交当前会话模型摘要为 `role=system` 并重写记忆（`saveAll` 全量覆盖），摘要失败降级丢弃最早历史；`ChatService` 同步/流式均支持 `compress`。
- SSE 修正：已建流后模型/校验异常改为 `event: error` 结束，不再抛回 MVC 被改写成 JSON；前端 `streamChatMessage` 对非 SSE 响应解析 `message` 走 `onError`。
- 前端：模型配置页每模型「已验证/未校验」+ 卡片「校验已绑定模型（n）」，失败弹窗列原因；对话页模型下拉只显示已校验，新建会话落 `chat_session`，重命名/知识库范围/新增压缩开关均写回后端。`npm run build` EXIT=0。
- 验证（8125）：catalog `qwen-plus valid=false`；verify 返回 `{"valid":false,"message":"Key 有效但额度不足或无调用权限（上游返回 403）","latencyMs":653}`；`/llm/models` 返回 0；会话创建/列表合并/更新/详情通过；未校验模型对话返回 40000；压缩降级 8→6 条（日志 `上下文压缩完成 ... summarized=false`）。测试会话已清理。
- 已知缺口：当前无可用 LLM Key，压缩「摘要成功」路径未端到端回归；访客演示模型、SSE `delta/done` + 幂等 + 并发锁、temperature/topP/备注仍待做。
## 2026-11-13 单模型校验 / 多模态校验 / 模型类型

- `docs/sql/018_model_type_and_verify.sql`：`llm_model` 增 `model_type`（默认 `text`）；新建 `user_llm_model_verify`（unique(user_id,vendor_code,model_code)，is_valid / key_fingerprint / verify_error / last_verify_at）。开发库 `OK executed=7`。
- 校验与绑定解耦：`LlmBindingVerifier` 不再要求绑定，AK 解析顺序为「本次草稿 AK → 用户该供应商已保存 AK → 配置文件兜底」；结论按「用户 + 模型 + Key 指纹」落新表，换 AK 自动失效。新增 `POST /llm/models/{vendor}/{modelCode}/verify`（body `{apiKey?}`），旧 `/llm/bindings/.../verify` 保留兼容；`LlmModelRouter.resolve` 改为查校验记录 + 指纹一致。
- 模型类型：新增 `ModelType`（text / reasoning / vision / omni / image / video / audio / embedding / other），定义 `isChatCapable` 与 `fromCapabilities` / `inferFromCode`。多模态理解（vision）校验走百炼原生 `https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation`（公开示例图 + 极短指令）；图像/视频/语音/向量类只确认账号模型列表可见。
- 同步：`LlmCatalogAdminService` 不再只保留 TG，拉取供应商全部模型并保存 `model_type`（百炼按 capabilities 映射、OpenAI 兼容按编码推断）；新增/编辑接口接受 `modelType`；目录/绑定 DTO 下发 `modelType` / `verifyError`。
- 前端：`ModelTypeTag`（9 类中文名 + 颜色 + lucide 图标）；模型配置页去掉批量校验，改为每行「校验」并按草稿 AK 调用，状态区分已验证 / 已验证·待绑定 / 未校验 / 校验失败；模型目录新增类型列与类型表单项；对话页模型下拉带类型图标。`npm run build` EXIT=0。
- 验证（8125）：未绑定 `qwen-plus` + 假 AK → 401 翻译（证明不要求绑定）；无 AK 且未绑定 → 系统兜底返回 403；临时 `vision` 模型假 AK 走原生 URL 返回 401；`modelType` 在 catalog/admin 列表贯通；已绑定但未校验的 `qwen3.8-flash` 对话返回「模型未通过连通校验」（40000）。测试模型/记录已清理，8125 已停止。
- 已知缺口：无有效 LLM Key，多模态与同步的成功路径只能验证解析与错误路径；非对话模型是否允许绑定尚未定策略；未绑定校验记录暂无 TTL。
## 2026-11-13 百炼地域 / 业务空间（019）

- `docs/sql/019_llm_workspace_region.sql`：`user_llm_binding` 增 `workspace_id VARCHAR(64)` / `region VARCHAR(32)`，加索引 `idx_user_llm_binding_workspace(user_id,vendor_code,workspace_id)`。开发库 `OK executed=5`。
- 生效地址：新增 `DashScopeEndpoint`（workspace/region 白名单、标准/空间域名拼装、去 `/compatible-mode`）与 `LlmEndpointService`（解析用户保存 → 配置 → 默认 `cn-beijing`，并生成「AK + workspace + region」复合指纹）。有 workspace → `https://{workspace}.{region}.maas.aliyuncs.com`；无 workspace → 标准域名或配置 `base-url`。
- 保存：`user_llm_binding` 新增字段；`LlmVendorProps` 增 `workspace-id/region`；`CatalogVendorItem` 下发用户保存值 / 生效值 / 兜底标记 / 生效 baseUrl；`batchBind` 接收 `workspaceId/region`（null 不修改、空串清除），新绑定继承同供应商已有值。
- 校验/路由/同步：`verify` 接收草稿 `workspaceId/region` 并按生效地址探测（多模态 URL 同源）；`LlmModelRouter` 校验指纹改复合值、ChatModel 缓存键加入地址指纹、`createModel` 用生效 baseUrl；管理端同步模型列表也走生效地址。
- 前端：模型配置页「业务空间 / 地域」输入框（仅百炼），展示生效地址与系统兜底；保存与单模型校验都带草稿值；类型与 API 参数同步。`npm run build` EXIT=0。
- 验证（8125）：`qwen3-vl-plus` 多模态校验在业务空间与标准域名均 valid=true（约 1s）；`batchBind` 保存 `llm-j09pwqdqv4no16ww` 后 catalog 生效地址为空间域名，且 `qwen-max` 真实对话返回「你好」；不传 workspace 的批量保存保留旧值；非法 workspace 被业务码 40000 拒绝；空间 `/api/v1/models` 可读（373 条）。测试绑定 / 模型上架状态 / 会话 / 校验记录已清理，8125 已停止。
- 已知限制：`vision` 模型（如 `qwen3-vl-plus`）走现有文本生成对话路径会返回 `url error`（标准域名亦同），需后续接多模态生成路径；系统配置了 workspace 时，用户无法在同一页面强制走标准域名（清空即回落配置）。
## 2026-11-13 百炼对话改 OpenAI 兼容接口（修复 Qwen3.8-27B `url error`）

- 根因：`DashScopeVendorFactory` 用 `DashScopeChatModel` 走原生 `/api/v1/services/aigc/text-generation/generation`，该路径只覆盖老模型；`qwen3.8-27b`（capabilities `TG / Reasoning / VU`）原生接口直接 400 `url error`。实测同一 Key 下兼容接口 `https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions` 与业务空间 `https://llm-j09pwqdqv4no16ww.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/chat/completions` 均 200「你好」。
- 对话工厂：`DashScopeVendorFactory` 改为 `OpenAiChatModel` + `OpenAiApi`，baseUrl 统一补 `/compatible-mode/v1`；因 Spring AI 默认再拼 `/v1/chat/completions`，显式设置 `completionsPath=/chat/completions`，避免 `/v1/v1` 404。AK / 生效业务空间 / 实例缓存键逻辑不变。
- 校验：`LlmBindingVerifier` 的 VU 探测从原生 `multimodal-generation` 改为同一条兼容 `/chat/completions`（`image_url` + 极短文本），校验地址与对话地址一致；生成类请求超时由 20s 放宽到 60s（多模态实测 8~40s）。
- 业务空间落库：校验通过且带草稿 `workspaceId/region` 时，回写该 `user+vendor` 下所有绑定行，保证对话 `resolveSaved` 拿到与校验相同的端点，避免「校验用空间域名、对话回落标准域名」。
- 验证（8125）：`qwen3.8-27b` 用 `llm-j09pwqdqv4no16ww / cn-beijing` 校验 `valid=true`（约 4s），随后 `/chat/message` 返回 `code=0`「你好」（约 1.7s）；绑定表 `workspace_id=llm-j09pwqdqv4no16ww`、`region=cn-beijing`、指纹一致。测试会话已删除，8125 已停止。
- 注意：Spring AI `OpenAiApi` 默认 completionsPath 是 `/v1/chat/completions`；接入任何已带版本段的 baseUrl 时必须显式覆盖，否则 404。`OpenAiCompatVendorFactory`（DeepSeek）同步修正：baseUrl 以 `/v1` 结尾时改用 `/chat/completions`，避免 `/v1/v1`。`qwen3.8-27b` 的 `model_type` 仍为 `vision`（同时具备 TG+VU），对话走兼容文本路径已可用。

## 2026-11-13 模型目录记录全部模态 + 同步更新已有数据（020）

- `docs/sql/020_llm_model_modalities.sql`：`llm_model` 增 `modalities VARCHAR(255)`（逗号分隔的 ModelType code），按 `model_type` 回填。开发库 `OK executed=3`，373 行无空值，且全部包含主类型。
- `vc-llm/model/ModelType`：新增 `allFromCapabilities`（TG→text、Reasoning→reasoning、VU→vision、IG→image、VG→video、ASR/TTS→audio、ME→embedding、omni→omni），`primaryFrom` 决定主类型；不再遇 `VU` 直接返回、丢弃 `TG/Reasoning`。新增 `ModelModalities` 负责逗号串编解码与表单归一（模态里一定包含主类型）。
- `vc-llm/service/LlmCatalogAdminService`：同步由「遇到同 code 直接 skipped」改为「按 code 映射已有行，刷新主类型与全部模态」；仅当展示名为空或等于编码时才用供应商名称覆盖，保留管理员自定义名称、上下架、温度、上下文；不删除供应商已下线模型。同步结果新增 `updated / updatedCodes / unchanged`（`skipped` 保留为 unchanged 兼容值）。
- DTO：`AdminModelItem` / `CatalogModelItem` / `LlmModelItem` 增 `modalities`；`AdminModelSaveRequest` 接受 `modalities` 列表；新增/编辑接口保存全部模态。
- 前端：`ModelTypeTag` 扩展 `ModelModalityTags` / `ModelModalityIcons`；管理目录类型列改为「类型 / 模态」多标签+按任一模态筛选，表单支持多选全部模态；模型配置页与对话下拉按全部模态展示图标。`npm run build` EXIT=0。
- 验证（8125）：`mvn -o -q -pl vc-llm,vc-app -am -DskipTests compile` EXIT=0。首次同步 `total=373 / added=0 / updated=84 / unchanged=289`，`qwen3.8-27b` 由 `model_type=vision, modalities=[vision]` 变为 `model_type=reasoning, modalities=[text,reasoning,vision]`；二次同步 `updated=0 / unchanged=373`（幂等）。`/llm/models` 与 `/llm/catalog` 均下发三模态；`qwen3.8-27b` 对话 `code=0`「你好」约 1.54s。临时新增/编辑模型验证多模态保存后已删除；测试会话已删除，8125 已停止。
## 2026-11-14 前端视觉规范落地 + 登录页改版（视觉基准确立）

- **背景**：前端此前无统一视觉规范，页面各自为政（纯白卡片、硬编码紫 `#7C3AED`、深浅色不一致）。登录页被用户指定为改版起点，改完后沉淀为规范。
- **新增文档**：`VeythCog-V/docs/frontend-style-guide.md`（14 节）。核心：颜色三层（presets → ThemeContext.colors → CSS 变量）、令牌表（radius/space/shadow/font/easing/duration/z-index/glass）、玻璃四层配方、排版表、动效约束（只动 transform/opacity、位移 ≤20%、scale 0.94–1.28、必须写 reduced-motion 与 pointer:coarse 降级、同屏常驻动画 ≤2 组）、暗色 7 项清单、新页面 10 条 checklist、8 条真实反模式。
- **登录页（`VeythCog-V/src/pages/Login/index.tsx` + 新建 `login.css`）**：两栏（品牌语 + 玻璃卡）；场景层 = 静态 `core` 底光 + 漂移光斑 a/b/c/d（5/5/7/4s）+ `orbit` ±7°/12s + 指针视差 34px/26px + 网格 + 噪点 + 暗角呼吸；卡片 `blur(32px) saturate(180%)` + `::before` 1px 渐变描边 + `::after` 顶部霜面；`conic-gradient` 亮边跟随指针方位（`atan2(dx,-dy)`、lerp 0.18、距离衰减 `clamp(.32, 1.18-dist*.42, 1)`）。
- **设计与无障碍决策**：放弃 `primary→accent` 渐变（amethyst 的 accent 是 `#FBBF24`，紫→黄=夕阳橙），改同色相白/黑叠加；暗色 preset primary 被提亮（`#A78BFA`）白字仅 2.4:1，改"亮填充 + `#14102B` 深字"（≈8:1）；覆盖 Chrome autofill 的 `#E8F0FE`；≥1900px 放大档与 `max-height:780px` 压缩档。
- **验证**：`npx tsc --noEmit` EXIT=0；动效实测 a 94px/s、b 89、c 87、d 57、orbit 2.09°/s；描边方位右下 146.33°（期望 146.3°）、左下 -147.8°（期望 -146.3°）；光源与卡片矩形重叠面积 0。
- **用户约束（长期）**：视觉验收不要用截图，用 computed style / getBoundingClientRect 数值；回复中不输出图片。
