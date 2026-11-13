# PROJECT_MEMORY · VeythCog 项目记忆文档

> **本文件用途**：给未来的 AI Agent（以及协作者）快速恢复项目心智模型，减少每次迭代重新摸底的成本。
> **维护规则**：每次项目迭代（改架构、加接口、换库、迁移模块）后，由 Agent 在本文件同步更新，并保持与真实代码一致。
> **信息基准**：2026-11-13，依据对仓库源码与配置的实际遍历（非仅凭 README）。

---

## 文档索引（AI 协作文档）

> 本仓库已规范化 AI 协作文档，Agent 协作时按需读取：
> - `PROJECT_MEMORY.md`：本文件，全局项目记忆（最重要，现状权威）
> - `.ai-context/global-rule.md`：编码规范 / 命名规约 / 错误处理 / 返回体格式（怎么做）
> - `.ai-context/current-tasks.md`：当前任务分配表（谁 / 做什么 / 状态 / 输出文件 / 依赖）
> - `.ai-context/change-log.md`：spec 变更记录（改了哪个接口 / 表，通知所有 Agent）
> - `openspec/knowledge-prd.md`：知识库 PRD（优化版 v0.2）
> - `openspec/api-spec.md`：知识库 API 契约
> - `openspec/sql/knowledge-init.sql`：知识库建表脚本

## 0. 一句话定位

VeythCog（渡思）——**个人全栈工作台 / 面试作品集**：一处聚合开发工具、代码片段、笔记与 AI 能力的自用门户；以「Java 后端 × LLM 工程化」为面试深水区。Monorepo，OpenSpec（规范驱动开发）工作流。

---

## 1. Monorepo 布局

```
VeythCog/                      # 仓库根（本项目记忆文档所在）
├── PROJECT_MEMORY.md          # ← 本文件
├── agent.md                   # AI Agent 协作开发规范（OpenSpec 流程 / 硬性约束 / 质量门）
├── README.md                  # 仓库总览（部分描述滞后，以本记忆文档为准）
├── openspec/
│   └── changes/p0-fullstack-connect/   # 已完成变更目录（proposal/design/tasks/specs）
├── VeythCog-C/                # 后端：Spring Boot 3.5 + Java 21 + Spring AI（模块化单体）
└── VeythCog-V/                # 前端：React 18 + TS + Vite + AntD 5 + Zustand
```

**端口约定**：后端 `:8123`（context-path `/api`），前端 `:3000`。

---

## 2. 技术栈

| 端 | 技术 | 说明 |
|---|---|---|
| 后端 | Spring Boot 3.5.8 / Java 21 / Maven | 模块化单体，父 pom 管版本（BOM：spring-ai-alibaba 1.1.2.0 / spring-ai 1.1.2） |
| 后端 | Spring AI（ChatClient / ChatMemory / Advisor） | LLM 统一抽象，流式走 `reactor` Flux |
| 后端 | Spring Security + JWT（jjwt 0.12.6）+ BCrypt | 无状态鉴权 |
| 后端 | Spring Data JPA / JDBC / MyBatis-Plus | 业务实体 + 记忆仓库；知识库域走 MP + pgvector |
| 数据库 | **PostgreSQL（当前 active，个人服务器 docker 容器）** | `ddl-auto=none`，表由 `docs/sql/*.sql` 管理；全模块已清除 MySQL 依赖（pom 无 mysql 驱动） |
| 接口文档 | springdoc + knife4j（springdoc 2.8.9 显式锁定） | `/api/doc.html`、`/api/v3/api-docs` |
| 前端 | React 18 / TS / Vite 5 / AntD 5 / Zustand(persist) / React Router 6 | fetch+ReadableStream 封装 SSE |

---

## 3. 后端：模块化单体（核心心智）

### 3.1 模块与依赖方向

```
vc-common(公共基础) ← vc-llm(LLM 网关) ← vc-chat(对话域) / vc-knowledge(知识库域) → vc-app(唯一可运行)
vc-admin(系统管理域：模型目录/监控/会话) → vc-llm / vc-common；禁止反依赖 vc-app
vc-learn(独立学习沙箱，零依赖业务模块，可单独运行)
```

- **依赖方向单向**：`common ← llm ← (chat, knowledge) ← app`；`common/llm ← admin ← app`；chat、knowledge、admin 互相不依赖。
- **仅 `vc-app` 可运行**（端口 8123，`/api`）；其余为纯库（无 boot 插件、无 main）。
- `vc-admin` 是 2026-11-13 新增的系统管理域（用户建议集中系统管理功能）。受依赖方向限制，`User` / `Role` 实体与用户、角色管理仍在 `vc-app`；模型目录管理、监控采集/查询、登录会话在 `vc-admin`（未来抽 `vc-user` 再迁）。
- RAG 组合动作规划落在 vc-app 的 `orchestration` 包（当前为空占位）。

### 3.2 各模块职责与关键类

**vc-common**（`com.vc.common`）：`BaseResponse`、`ResultUtils`、`PageRequest`、异常体系（`BusinessException` / `ErrorCode` / `ThrowUtils`）。

**vc-common · 对象存储（`com.vc.common.s3`，2026-11-10 新增）** —— RustFS（S3 协议，兼容 MinIO）基础设施封装：
- `S3Properties`：绑定 `storage.s3.*`（endpoint / access-key / secret-key / region / path-style / 预签名有效期 / 超时），密钥不外露到 `toString`。
- `S3StorageConfiguration`：只注册配置、`S3ClientProvider`、`S3StorageClient`、`S3PresignService`；`storage.s3.enabled=false` 时整体不装配。**无 Controller / 无鉴权 / 无业务库操作**。
- `S3ClientProvider`：懒加载 `S3Client` + `S3Presigner`（`UrlConnectionHttpClient`、强制 pathStyle）；配置缺失不阻断应用启动，首次调用才抛 `CONFIGURATION` 异常。
- `S3StorageClient`：`upload`（byte[] / InputStream / Path）、`delete`（幂等）、`exists`（HEAD 404 视为不存在）。
- `S3PresignService`：`presignPutUrl` / `presignGetUrl`（可带下载文件名、上限 7 天）、`publicUrl`（仅匿名可读桶）。
- `S3Bucket` 枚举统一桶名：`public-icons`（公开只读）、`wallpapers`（私有，仅预签名）。
- `S3ObjectKeyUtils`：`{prefix}/{yyyy}/{MM}/{dd}/{uuid}.{ext}` 生成 key + key 安全校验（拒绝 `..`、首尾 `/`、控制字符）。
- `S3FileValidator`：后缀白名单 / MIME 白名单 / 文件头魔数与扩展名一致性校验，白名单由业务传入。
- 异常族：`StorageException`（`CONFIGURATION` / `NETWORK` / `SERVICE` / `VALIDATION`）及 `StorageNetworkException`、`StorageServiceException`、`StorageValidationException`。
- 示例配置：`vc-common/src/main/resources/application-s3-example.yml`；真实配置在 `vc-app` 的 `application.yml`（环境变量 `RUSTFS_*`）。

**vc-admin**（`com.vc.admin`）—— 系统管理域（2026-11-13 新增，无 Controller 之外的装配依赖）：
- `monitor/MonitorProperties`：绑定 `monitor.*`（保留天数、队列容量、会话空闲阈值、采样开关）。
- `monitor/MetricsCollector`：`LinkedBlockingQueue` + 守护线程每 2s 批量落库；单请求明细写 `sys_api_sample`，同时按 `(bucket, method, route)` 对 `sys_api_metric_minute` 做 `INSERT ... ON CONFLICT` 累加 6 档耗时直方图；队列满丢弃并计数。
- `monitor/ResourceMonitor`：纯 JDK MXBean，采集系统/进程 CPU、物理内存、Swap、JVM 堆/非堆、线程数、磁盘（数据目录）；拿不到的指标（如 Windows 的 load average）返回 `-1`。
- `monitor/MonitorRetentionJob`：每日 03:30 清理过期明细/分钟桶/LLM 日志（`@EnableScheduling` 在 vc-app）。
- `monitor/LlmCallRecorderImpl`：实现 `vc-llm` 的 `LlmCallRecorder` SPI，落 `llm_call_log`。
- `monitor/entity/UserSession` + `repository/UserSessionRepository` + `service/SessionService`：登录建会话、20s 节流 touch、logout、kick、空闲过期；`sid` 写进 JWT。
- `service/MonitorQueryService`：overview / timeseries / endpoints / errors / llm / sessions 聚合查询（时间分桶按 `Asia/Shanghai`）。
- `web/AdminMonitorController`：`/admin/monitor/*` 全部监控接口（需 ADMIN）。模型目录管理仍在 `vc-llm` 的 `LlmCatalogAdminService`（由 `vc-app` 的 `AdminLlmModelController` 暴露），未迁入本模块。

**vc-llm**（`com.vc.llm`）—— LLM 调度网关（面试深水区①）：
- `enums/LlmVendor`：**供应商固定枚举**（`dashscope` 阿里百炼 / `deepseek`），不建表。
- `entity/LlmModel`（模型目录）、`entity/UserLlmBinding`（用户-模型绑定中间表）。
- `factory/LlmVendorFactory` + `DashScopeVendorFactory` / `OpenAiCompatVendorFactory`：按供应商创建 `ChatModel`，收敛厂商差异；**DashScope 必须按入参 AK 动态构建**，不得复用 starter 全局单例，否则用户自持 Key 不生效。百炼对话统一走 **OpenAI 兼容协议**（`OpenAiChatModel` + `{base}/compatible-mode/v1`，并显式 `completionsPath=/chat/completions`）；原生 `text-generation` 只覆盖老模型，Qwen3.8 系列会返回 `url error`。
- `router/LlmModelRouter`：核心。校验绑定→查模型→解析密钥（**用户自持 AK（AES 解密）优先 → 配置文件 AK 兜底**）→`ConcurrentHashMap` 缓存 `ChatClient`（key=`userId:vendor:modelCode:SHA256(key) 前8位`，换 Key 自然 miss）→ 挂 `MessageChatMemoryAdvisor`（JDBC 记忆）→ 提供**同步 `chat()`、流式 `stream()`、无记忆同步 `chatStateless()`（压缩摘要用）与 `probeUnbound()`（校验用，不要求绑定）**。对话路径要求绑定存在，且 `user_llm_model_verify` 中该模型的校验结论有效、`key_fingerprint` 与当前有效 Key 一致。同步改用 `.chatResponse()` 捕获供应商 usage，流式取最后一个 chunk 的 usage；缺失时按字符估算（CJK 1 字 1 token、其他 4 字符 1 token）并标 `usage_source=estimate`，统一交给 `LlmCallRecorder` SPI。
- `metrics/TokenEstimator`：统一 token 估算口径（压缩判定与监控共用）。
- `service/LlmBindingVerifier`：单模型连通校验——**不要求先绑定**，可携带前端草稿 AK；通过后用户再自由选择是否绑定。文本/推理/全模态走 chat 探测，百炼多模态理解（VU）也走同一条 OpenAI 兼容 `/compatible-mode/v1/chat/completions`（图片输入，保证「校验地址 = 对话地址」；生成类探测超时 60s）；图像/视频/语音/向量类只确认账号模型列表可见。**校验通过后若携带草稿业务空间/地域，会同步写回该供应商下所有绑定行**，避免工作空间级 Key 在校验时用空间域名、对话时回落标准域名导致超时/URL 错误。结论落 `user_llm_model_verify` 并记录 Key 指纹，换 AK 自动失效；失败按 401/403 额度/404/429/超时翻译，不抛异常。
- `model/ModelType` + `model/ModelModalities`：模型主类型枚举（text / reasoning / vision / omni / image / video / audio / embedding / other）与全部模态编解码；百炼 capabilities 全量映射（TG→text、Reasoning→reasoning、VU→vision、IG→image、VG→video、ASR/TTS→audio、ME→embedding、omni→omni），`model_type` 只作主类型（TG 存在时优先文本/推理，避免可对话模型被判成纯视觉），`modalities` 保存全部模态。
- `metrics/{LlmCallRecorder,LlmCallRecord}`：LLM 调用观测 SPI（供应商/模型/耗时/成败/usage），实现由 `vc-admin` 注入，`vc-llm` 不反向依赖管理域。
- `config/LlmVendorProps`：配置 AK/baseUrl（`llm.vendors.*`，兜底用）。
- `config/ApiKeyCryptoProps` + `crypto/ApiKeyCryptoService`：用户 Key 的 AES-256-GCM 加解密与脱敏，口令取 `LLM_KEY_AES_SECRET`（未配置时保存/解密报明确错误，不影响启动）。
- `service/LlmModelService`：绑定查询/目录/批量绑定/解绑/设默认/编辑或清除用户 AK（应用层保证默认唯一；AK 为「用户 + 供应商」级，同一 vendor 下所有绑定行共享密文）；`getModels` **只返回 enabled + 已校验 + 对话类模型**，目录项带 `modelType` / `valid`（与是否绑定无关） / `verifyError`；校验是否有效按「用户 + 模型 + 当前有效 Key 指纹」实时比对。
- `service/LlmCatalogAdminService`：管理端模型目录 CRUD + 上下架 + 从供应商同步（百炼原生 `/api/v1/models` 读取 capabilities 并映射**主类型 + 全部模态**，DeepSeek 走 OpenAI 兼容 `/models` 并按编码推断）；**不再过滤非文本模型**。同步会补齐缺失项，并刷新已有行的 `model_type` / `modalities`（修正历史错误数据），但保留管理员的上下架、温度、上下文与自定义展示名；不删除供应商已下线模型。同步 AK 取服务端兜底配置，缺失时回退管理员的用户自持 AK。
- `LlmChatService`：对外的对话入口，转发到 `LlmModelRouter`。

**vc-chat**（`com.vc.chat`）—— 对话域（无 Controller）：
- `ChatService`：领域入口，委托 `LlmChatService`，提供同步 `chat()` 与流式 `streamChat()`（均带 `compress` 开关，发消息前先走 `ContextCompressor`）。
- `ChatSessionService` + `entity/ChatSession` + `repository/ChatSessionRepository`：**独立会话表**（`chat_session`，按 `user_id + conversation_id` 唯一）持久化会话标题、会话级模型（`vendor_code/model_code`）、`rag_doc_ids`、`enable_context_compress`、软删除；`resolveForSend` 在每次发消息时兜底创建/更新，`ChatHistoryService` 列表按会话配置合并（未发消息的新会话也会出现）。
- `compress/ContextCompressor` + `ChatCompressProperties`：上下文动态压缩——估算 token 超 `chat.compress.threshold-tokens`（默认 4000）时，把最早历史交给**当前会话模型**摘要成 `role=system` 消息后重写记忆，保留最近 `keep-rounds`（默认 3）轮；摘要失败**降级丢弃最早历史**，不阻断本轮对话。
- `memory/ChatMemoryConfig`：把 MyBatis 记忆仓库包装成 Spring AI `ChatMemory`，`MessageWindowChatMemory` **窗口 20 条**截断。
- `memory/MyBatisChatMessageRepository`：实现 `ChatMemoryRepository`，落 `chat_message` 表（`(conversation_id, seq)` 排序，记忆主键=`userId:conversationId`）；`saveAll` 为**全量覆盖**（先删后插），因此压缩必须重写整个记忆列表。
- `mapper/ChatMessageMapper` + `resources/mapper/ChatMessageMapper.xml`：`chat_message` 的全部 SQL（会话聚合、消息列表、批量写入、删除），供记忆仓库与 `ChatHistoryService` 共用；**本模块不含 Java 内联 SQL**。
- `ChatHistoryService`：对外会话列表 / 历史回显（剥离 `userId:` 前缀、还原被 RAG prompt 包裹的用户问题），SQL 走上面的 mapper；列表合并 `chat_session` 配置并过滤 system 摘要消息。

**vc-nav**（`com.vc.nav`）—— 导航域（无 Controller，2026-11-12 补图标资产化）：
- `entity/NavCategory` / `NavBookmark` / `NavSetting`：`nav_bookmark` 自 013 起含 `icon_type`（auto/upload/text）、`icon_key`（S3 key）、`icon_text`、`icon_color`、`icon_synced_at`；图标字段 `updateStrategy=ALWAYS`，保证切换图标类型时能写 NULL。
- `service/NavBookmarkService`：分类/bookmarks CRUD、排序；列表下发 `BookmarkView`（含 `hasIcon` / `iconKey`，不下发直链）；新增/更新时校验图标字段（文字 1~3 字、颜色 `#RGB/#RRGGBB`、`iconKey` 必须在 `icons/` 前缀且对象存在）；auto 且无 key 的书签异步补同步。
- `service/SiteIconFetcher`：解析 HTML `<link rel=icon>` + 同源 `/favicon.ico` / apple-touch 回退，最多 6 候选；只允许 http/https，DNS 解析后拒绝回环/私网/link-local/组播（重定向后再复核）；6s / 512KB 上限；文件头魔数识别 png/jpeg/gif/webp/bmp/ico，**拒绝 SVG**；候选图标请求带站点 `Referer`（绕过部分 CDN 防盗链）。
- `service/NavIconService`：站点抓取/自定义上传 → `public-icons`；`resolve()` 进程内缓存 10 分钟（签名=图标字段+updatedAt）→ DB → `S3PresignService.publicUrl`；`syncMissing()` 只补 `icon_type=auto` 且无 `icon_key`、失败冷却 1 天的书签；2 线程守护池异步执行。上传对 `application/octet-stream` 只信魔数，显式拒绝无魔数文件。
- `service/NavIconStartupSync`：`ApplicationReadyEvent` 投递后台补同步（`nav.icon.sync-on-startup=false` 可关，单次上限 200）。
- `scripts/import_itab_backup.py`（在 `VeythCog-C/scripts`）：iTab `navConfig` 容错解析 → 按 URL 归一化去重 → SVG/ICO 用 Chrome 渲染 256px PNG（2 倍窗口截图 + alpha 包围盒裁剪，避免高 DPI 半图）→ `POST /nav/icons/upload` → `POST /nav/bookmarks` / `PUT /nav/bookmarks/{id}`；`state.json` 断点续跑，失败降级文字图标；支持 `--token` / `--chrome` / `--work-dir` / `--dry-run`，线上同步说明见 `scripts/README-nav-import.md`。2026-11-12 导入 249 条、更新 8 条已有图标、245 个唯一 S3 对象被引用。
- `NavWallpaperService`：壁纸列表/随机/锁定 + 私有桶缩略图代理。

**vc-app**（`com.vc.app`）—— 唯一可运行，装配全部：
- `auth/*`：JWT 鉴权（`JwtUtil` / `JwtAuthFilter` / `AuthServiceImpl` / `PasswordUtil` / `User`）。JWT 自 2026-11-13 带 `sid`，`JwtAuthFilter` 每次请求校验会话（kicked/expired 即 401）；`AuthServiceImpl.login(request, ip, ua)` 建 `sys_user_session`，`POST /auth/logout` 置 logout。**旧 token 无 sid 会失效，需重新登录**。
- `web/*`（Controller）：`ChatController`（`/chat/message` 同步 + `/chat/stream` SSE + `/chat/conversations` 三件套 + `/chat/sessions` 会话配置五件套）、`LlmModelController`（含 `POST /llm/models/{vendor}/{modelCode}/verify` 单模型校验）、`AuthController`、`HealthController`、`KnowledgeController`（P0 已实现 10 个接口）、`NavBookmarkController` / `NavCategoryController` / `NavWallpaperController` / `NavSettingController`（导航 + `GET /nav/bookmarks/{id}/icon`）、`NavIconController`（`POST /nav/icons/fetch|upload|sync`）、`GlobalExceptionHandler`、`ApiAccessLogFilter`（采集型访问日志：rid/user/ip/方法/**归一化路由**/业务码/HTTP 状态/耗时/流式标记/错误信息，敏感字段不落库，`/api/admin/monitor` 自身不打点）、`BizCodeAdvice`（`ResponseBodyAdvice`：把 `BaseResponse.code` 写进请求属性，供过滤器记录——后端业务错误也是 HTTP 200，只看 status 错误率恒为 0）。
- `config/*`：`SecurityConfig`（无状态，放行 `/auth/**`、`/health/**`、接口文档、ASYNC 分发）、`CorsConfig`、`DataInitializer`（幂等种子：模型目录 + admin 用户 + 默认绑定 qwen-plus）。
- `admin/*`：系统管理后端**已实现**（`AdminController` / `RoleController` / `AdminUserServiceImpl`，用户-角色多对多，`/admin/**` 需 `ADMIN` 角色）。
- `orchestration/*`：`RagChatOrchestrator`（检索 → 拼带编号引用的上下文 → 交 vc-chat 作答；同步/流式共用，召回落空或失败降级为普通对话）。

**vc-knowledge**（`com.vc.knowledge`）—— 知识库域（无 Controller）：
- `entity/KnowledgeDoc` + `entity/KnowledgeEmbedding`（MyBatis-Plus 注解实体，TypeHandler：`JsonbTypeHandler`(block_data jsonb) / `StringArrayTypeHandler`(tags text[]) / `VectorTypeHandler`(embedding vector(1024))）、`mapper/KnowledgeDocMapper` + `mapper/KnowledgeEmbeddingMapper`（XML 承载 PG 特有语法）。
- `service/KnowledgeService` + `impl/KnowledgeServiceImpl`：文档 CRUD / 导入导出（普通 CRUD 用 MP BaseMapper + LambdaWrapper）；关键词列表检索（`to_tsvector('simple', ...)` + `plainto_tsquery`）与 tags 数组过滤收拢到 XML。
- `service/VectorizeService` + `impl/VectorizeServiceImpl`：自定义 `RecursiveCharacterTextSplitter`（512/64，优先保留代码块）→ `EmbeddingProvider` 批量编码（qwen3.7-text-embedding-flash，维度 1024）→ pgvector `<->` L2 检索（IVFFlat）；先删后插幂等（`doc_id` 为幂等键）+ `embedding_model` 标识校验。⚠️ L2 阈值配置 1.2（原 0.8 会过滤掉全部候选）；阈值无命中时回退 topN 并打 WARN。
- `knowledge_doc.lib_type` 列已**物理删除**（`011` 新版 `DROP COLUMN`，需在库上重跑一次）；「私有库/演示库」概念彻底废弃。本模块**先不做按用户隔离**（见 §10.1）。

**vc-learn**（`com.vc.learn`）—— **Spring AI 学习沙箱**：独立可运行、只连 DashScope、与业务模块零依赖。含 `examples/chat`（`ChatDemo` / `ChatController` / Advisor：`RereadingAdvisor` / `SimpleLoggerAdvisor`）、结构化输出测试（`StructuredOutTest`）等。**git status 有未提交改动**（ChatController 修改 + 新增 service/ 与测试）。

---

## 4. 三大深水区：当前实现状态（以代码为准）

| 深水区 | 架构文档记录 | **代码实际状态（2026-10-15）** |
|---|---|---|
| ① llm-gateway 多模型调度 | Phase 1 | ✅ 已落地：供应商抽象+工厂+路由+实例缓存；DashScope 与 OpenAI 兼容双工厂 |
| ② SSE 流式全链路 | Phase 1 待办 | ✅ **已落地**：`POST /chat/stream`（SseEmitter + Flux 逐 token，`[DONE]` 结尾，客户端断开取消上游）；前端 `api/chat.ts` `streamChatMessage()` |
| ③ 会话/消息持久化 | Phase 1 待办 | ✅ **已落地（记忆层 + 历史回显 + 独立会话表）**：Spring AI `ChatMemory` + `MyBatisChatMessageRepository`（SQL 在 `ChatMessageMapper.xml`）；`GET /chat/conversations`、`GET /chat/conversations/{id}/messages`、`DELETE` 已对外；`chat_session`（017）持久化会话级模型 / `rag_doc_ids` / 上下文压缩开关，刷新不再丢配置；上下文超阈值自动摘要最早历史（失败降级丢弃） |
| RAG 知识库 | Phase 2 | ✅ **已落地（P0）**：文档 CRUD + 导入导出 + 向量化（pgvector `<->` L2）+ RAG 召回；前端知识库页（`DocEditor` 基于 BlockNote）+ 对话侧引用卡片。✅ 召回已**注入 prompt**并由后端统一下发引用（`RagChatOrchestrator` + SSE `event: references`，`ChatRequest.docIds`）；已去除「私有库/演示库」概念（`lib_type` 列已删）；⚠️ 文档更新仅置 `is_vectorized=false`、不删旧向量（检索端已过滤，旧向量仅占空间） |

**RAG 元数据自动填充 + 检索 rerank（2026-11-09 落地）**
- 摘要 / 标签属于文档元数据，向量化时由**辅助小模型**自动补齐；策略**仅填空值**（手写内容不被覆盖），摘要与标签都完整时直接跳过模型调用。
- 手动「AI 重新生成」：`POST /knowledge/doc/{docId}/metadata/regenerate` 显式覆盖，前端工具栏 sparkles 图标 + Popconfirm 二次确认；只改元数据，不动正文与向量化状态。
- 前端元数据编辑：摘要与标签**统一在一个「编辑元数据」弹窗**内编辑（工具栏单入口），点弹窗「保存」直接落库；`handleSave` 支持传入草稿值覆盖，避免 `setState` 异步导致读到旧值。取消则丢弃草稿，不再有独立的摘要弹窗 / 标签 Popover。
- 辅助模型与用户对话模型**解耦**：`llm.aux-model.*` → `AuxModelProps` + `AuxChatService`（无记忆、一次性 `complete(system,user)`；DashScope 必须按请求传 `DashScopeChatOptions.model(...)`）。当前 `model-code: deepseek-v4-pro-0813`——该账号 `qwen-turbo` 返回 429、`qwen-plus` 返回 403，仅此模型可用，开通 qwen 后改回。
- 检索 rerank：`RagReranker` 用同一辅助模型对候选片段重排后截 `topN`；配置 `knowledge.retrieve.rerank`（`enabled` / `candidates=10` / `max-chunk-chars=400`）；模型异常或编号缺失自动回退向量顺序，不阻断回答。
- 实现位置：`vc-app/orchestration/{KnowledgeMetadataOrchestrator,RagReranker,DocMetadata,VectorizeResult}.java`、`vc-llm/{AuxChatService,AuxModelProps}.java`。

> **重要**：`docs/architecture.md` 与 `agent.md` 仍把 SSE 流式/会话持久化列为待办——**文档滞后于代码**。新增迭代前先读代码，别信旧文档。

---

## 5. 数据模型（PostgreSQL 方言，脚本见 `VeythCog-C/docs/sql/`）

| 表 | 说明 | 关键约束 |
|---|---|---|
| `app_user` | 用户 | username unique；password 为 BCrypt |
| `llm_model` | 模型目录（vendor_code 仅存字符串，供应商为枚举不建表） | unique(vendor_code, model_code)；`model_type`（`018`）为主类型：text / reasoning / vision / omni / image / video / audio / embedding / other；`modalities`（`020`）保存全部模态（逗号分隔，至少包含主类型），用于目录/选择页多图标展示与校验 URL 选择；由 `/admin/llm-models` 增删改查 + 上下架，启动时仅在**空表**插入 qwen-plus / deepseek-chat 两条种子 |
| `user_llm_binding` | 用户-模型绑定中间表 | unique(user_id, vendor_code, model_code)；is_default 应用层保证每用户至多 1 个；`api_key_cipher`（TEXT，AES-256-GCM 密文 `base64(iv):base64(ct)`）/ `api_key_updated_at`（`015_user_llm_binding_api_key.sql`），NULL = 配置兜底；AK 为「用户 + 供应商」级，同 vendor 各行共享密文；`workspace_id` / `region`（`019`）同为供应商级，NULL = 回落 `llm.vendors.dashscope.workspace-id/region`；`is_valid/last_verify_at/verify_error`（017）已**废弃**，校验结论以 `user_llm_model_verify` 为准 |
| `user_llm_model_verify` | 单模型校验记录（`018_model_type_and_verify.sql`） | unique(user_id, vendor_code, model_code)；is_valid / `key_fingerprint`（SHA-256 前 8 位） / verify_error / last_verify_at；与绑定解耦，指纹为「AK + workspace + region」复合值（`019`），换 AK 或换业务空间/地域即失效 |
| `chat_message` | 对话记忆（Spring AI JDBC 落库） | unique(conversation_id, seq)；conversation_id=`userId:conversationId`；压缩摘要以 `role=system` 存在此处，回显时过滤 |
| `chat_session` | 会话级配置（2026-11-13，`017_p0_verify_and_session.sql`） | unique(user_id, conversation_id)；session_title / vendor_code + model_code / rag_doc_ids（逗号分隔）/ enable_context_compress / deleted 软删除；与 `chat_message` 通过 conversation_id 关联 |
| `knowledge_doc` | 知识库文档 | 无 `lib_type`（历史列已由 `011` 删除）；block_data JSONB 权威源；markdown_text 派生缓存；tags text[]；deleted 软删除；summary ≤500。新库按 `009→010→011` 执行 |
| `knowledge_embedding` | 文档分片向量 | embedding vector(1024)（IVFFlat `vector_l2_ops` 索引）+ `embedding_model` 标识（禁止不同模型向量混查）；doc_id 外键（软删除时显式清理，不依赖级联）。⚠️ `embedding_model` 由 `010` 补充，服务器库已执行 |
| `nav_category` | 导航分类（iTab 右侧竖栏） | 按 user_id 隔离；sort_order 排序 |
| `nav_bookmark` | 导航书签 | `icon_type`（auto/upload/text，CHECK 约束）、`icon_key`（`public-icons` 对象 key）、`icon_text`、`icon_color`、`icon_synced_at`；`013_nav_bookmark_icon.sql` 幂等增量 |
| `nav_setting` | 导航首页配置（一人一行） | `current_wallpaper_key` NULL = 每次随机；activeCategoryId / 搜索引擎 |
| `sys_api_sample` | 接口调用单请求明细（2026-11-13，`016_observability.sql`） | rid / user_id / ip / method / route（归一化 pattern）/ handler / status / biz_code / cost_ms / stream / error_msg；按时间 + 路由检索 |
| `sys_api_metric_minute` | 接口分钟桶聚合 | unique(bucket, method, route)；calls / errors / 6 档耗时直方图（p95 由直方图估算），采集时 `ON CONFLICT` 累加 |
| `llm_call_log` | LLM 调用用量 | vendor / model_code / user_id / prompt_tokens / completion_tokens / total_tokens / latency_ms / status / error_msg / usage_source（provider \| estimate） |
| `sys_user_session` | 登录会话（JWT 携带 sid） | sid varchar(36) 主键；status active/kicked/logout/expired；login_at / last_active_at / ip / user_agent |

> 导航数据入库：`014_nav_itab_data.sql` 内置 7 分类 + 267 书签（含图标字段），首次按 `(user_id,name)` / `(category_id,url)` 插入，已有同 URL 书签同步图标字段；默认目标用户 `admin`，线上执行前先备份三表，详见 `docs/sql/README-014-nav-data.md`。

> `llm_vendor` 表已**下线**（`005_drop_llm_vendor.sql`），改后端枚举。脚本含 MySQL/PG 双语差异注释。

---

## 6. 后端关键接口契约（context-path `/api`）

| 方法 | 路径 | 请求体 | 鉴权 |
|---|---|---|---|
| POST | `/auth/login` | {username, password} | 否 |
| GET | `/llm/models` | - | 是（当前用户绑定启用模型） |
| GET | `/llm/catalog` | - | 是（供应商枚举+模型目录+绑定标记；含用户保存/生效的 workspace、region、生效 baseUrl 与兜底标记） |
| POST | `/llm/bindings` | {vendor, modelCode, isDefault?} | 是 |
| POST | `/llm/bindings/batch` | {vendor, modelCodes[], apiKey?, defaultModelCode?, workspaceId?, region?} | 是（供应商→多选模型；apiKey 留空不改；空数组=解绑该供应商全部；default 必须来自选中集合；workspace/region：null 不修改、空串清除并回落配置） |
| PUT | `/llm/vendors/{vendor}/api-key` | {apiKey} | 是（加密写入该供应商下全部绑定行） |
| DELETE | `/llm/vendors/{vendor}/api-key` | - | 是（清除用户 AK，回落配置兜底） |
| DELETE | `/llm/bindings/{vendor}/{modelCode}` | - | 是 |
| PUT | `/llm/bindings/{vendor}/{modelCode}/default` | - | 是 |
| POST | `/llm/models/{vendor}/{modelCode}/verify` | {apiKey?, workspaceId?, region?} | 是（单模型校验，**无需先绑定**；apiKey/workspace/region 均为草稿值不落库；百炼多模态走原生 multimodal URL；失败返回 valid=false + 原因） |
| GET | `/admin/llm-models` | - | **仅 admin**（全部模型含未上架 + bindingCount + modelType） |
| GET | `/admin/llm-models/vendors` | - | 仅 admin（供应商枚举选项） |
| POST | `/admin/llm-models` | {vendor, modelCode, modelName?, modelType?, maxContextTokens?, temperature?, enabled?} | 仅 admin（编码重复 40000） |
| PUT | `/admin/llm-models/{id}` | 同上 | 仅 admin（已有绑定则禁止改供应商/编码） |
| DELETE | `/admin/llm-models/{id}` | - | 仅 admin（仍有用户绑定 → 40000） |
| PUT | `/admin/llm-models/{id}/enabled` | {enabled} | 仅 admin（上架/下架） |
| POST | `/admin/llm-models/sync` | {vendor, enableNew?} | 仅 admin（从供应商拉取全部模型，补齐缺失并刷新已有主类型/全部模态；不删除，新增默认不上架） |
| POST | `/chat/message` | {message, vendor, modelCode, conversationId?, docIds?, compressEnabled?} | 是（同步返回 string；先按会话配置解析模型/文档/压缩，docIds 非空时先召回再拼上下文；模型未校验返回 40000） |
| POST | `/chat/stream` | {message, vendor, modelCode, conversationId?, docIds?, compressEnabled?} | 是（SSE：先 `event: references`（JSON 数组），后 `data: <token>`，末尾 `data: [DONE]`，错误 `event:error`；已建流后的错误不再改写成 JSON） |
| GET | `/chat/conversations` | - | 是（会话列表 = `chat_message` 聚合 + `chat_session` 配置合并，剥离 `userId:` 前缀，按最近活动倒序；未发消息的新会话也返回） |
| GET | `/chat/conversations/{id}/messages` | - | 是（按 `seq` 升序回显；RAG 落库的「上下文+问题」在返回时剥离为原始问题） |
| DELETE | `/chat/conversations/{id}` | - | 是（物理删除该会话记忆行 + 软删除会话配置） |
| POST | `/chat/sessions` | {conversationId?, title?, vendor?, modelCode?, docIds?, compressEnabled?} | 是（新建/覆盖会话配置；conversationId 为空则后端生成） |
| GET | `/chat/sessions` | - | 是（当前账号全部会话配置） |
| GET | `/chat/sessions/{conversationId}` | - | 是（会话配置详情） |
| PUT | `/chat/sessions/{conversationId}` | 同上（null 字段不改，docIds=[] 清空） | 是（更新会话标题/模型/文档集合/压缩开关） |
| DELETE | `/chat/sessions/{conversationId}` | - | 是（软删除会话配置） |
| GET | `/knowledge/list` | query: keyword?, tag?, sortField?, sortOrder?, current?, pageSize? | 是（登录即可访问，暂不做用户隔离） |
| GET | `/knowledge/doc/{docId}` | - | 是 |
| POST | `/knowledge/doc` | {title, summary?, tags?, blockData?, markdownText?} | 是 |
| PUT | `/knowledge/doc/{docId}` | 同新建 | 是 |
| DELETE | `/knowledge/doc/{docId}` | - | 是（软删除 + 显式清理 embedding） |
| POST | `/knowledge/import/md` | multipart: file(.md≤500KB), title?, tags? | 是 |
| GET | `/knowledge/doc/{docId}/export/md` | - | 是（下载流） |
| POST | `/knowledge/doc/{docId}/vectorize` | - | 是（返回 `{chunkCount, summary, tags}`，同时按「仅填空值」补齐摘要/标签） |
| POST | `/knowledge/doc/{docId}/metadata/regenerate` | - | 是（辅助模型显式覆盖摘要/标签，只改元数据不动正文） |
| POST | `/knowledge/doc/{docId}/unvectorize` | - | 是 |
| POST | `/knowledge/rag/retrieve` | {docIds, query, topN?} | 是（限定 docIds + embedding_model + L2 阈值 1.2；阈值无命中自动回退 topN；禁止全库向量搜索） |
| GET | `/nav/bookmarks` | query: categoryId | 是（返回 `BookmarkView`，含图标字段 + `hasIcon`） |
| POST/PUT/DELETE | `/nav/bookmarks`、`/nav/bookmarks/{id}` | {categoryId?, title, url, iconType?, iconKey?, iconText?, iconColor?} | 是（图标字段服务端校验；auto 无 key 异步补同步） |
| PUT | `/nav/bookmarks/reorder` | {categoryId, items:[{id,sortOrder}]} | 是 |
| GET | `/nav/bookmarks/{id}/icon` | - | 是（进程缓存 → DB → S3 公开直链；`url=null` 表示无图） |
| POST | `/nav/icons/fetch` | {url} | 是（SSRF 防护 + 抓取 + 上传 public-icons） |
| POST | `/nav/icons/upload` | multipart: file（≤512KB） | 是（png/jpg/jpeg/webp/gif/ico，按魔数识别） |
| POST | `/nav/icons/sync` | - | 是（补齐当前用户缺失 auto 图标，返回 {total,success,failed}） |
| GET/POST/PUT/DELETE | `/nav/categories`、`/nav/categories/{id}` | 分类 CRUD | 是 |
| GET | `/nav/wallpaper/random`、`/list`、`/current`，`PUT /nav/wallpaper/lock` | - | 是（缩略图 `/nav/wallpaper/thumb` permitAll） |
| GET/PUT | `/nav/setting` | {searchEngine?, activeCategoryId?} | 是 |
| POST | `/auth/logout` | - | 是（当前 sid 置 logout，token 立即失效） |
| GET | `/admin/monitor/overview` | query: hours=24 | 仅 admin（调用量/错误率/P95/Token/会话/LLM 汇总） |
| GET | `/admin/monitor/timeseries` | query: hours | 仅 admin（≤24h 按小时、>24h 按天） |
| GET | `/admin/monitor/endpoints` | query: hours, sort=calls\|errors\|p95, limit | 仅 admin（接口排行，含 avg/p95/max） |
| GET | `/admin/monitor/errors` | query: hours, limit | 仅 admin（业务码非 0 或 HTTP≥400 明细） |
| GET | `/admin/monitor/llm` | query: hours | 仅 admin（按供应商+模型聚合 token 与延迟） |
| GET | `/admin/monitor/sessions` | - | 仅 admin（在线/最近会话） |
| POST | `/admin/monitor/sessions/{sid}/kick` | - | 仅 admin（置 kicked，该 token 下一次请求 401） |
| GET | `/admin/monitor/resources` | - | 仅 admin（CPU/内存/Swap/JVM 堆/线程/磁盘，缺失为 -1） |
| GET | `/admin/monitor/status` | - | 仅 admin（采集队列深度/丢弃计数） |
| GET | `/health` | - | 否 |

统一返回 `BaseResponse<T>`：`{ code, data, message }`，`code===0` 成功；未登录 401（`ErrorCode.NOT_LOGIN_ERROR`）。

> **知识库权限现状（2026-11-09 决策）**：接口只校验"已登录"，**暂不按用户隔离**，知识库为全账号共享数据（单账号自用可接受）。用户级赋权计划由统一中间件承担，落地后本模块只消费中间件给出的授权结果，不自行维护 owner 校验。

---

## 7. 前端架构（VeythCog-V）

### 7.1 三层依赖方向
```
页面组件 → stores/（Zustand 业务状态）→ api/（数据请求）→ mock/ 或 真实后端
                                 ↘ config/（环境变量统一读取层，业务不直接碰 import.meta.env）
                                 ↘ utils/storage.ts（localStorage 封装，命名空间+TTL）
```

### 7.2 核心封装
- `api/client.ts`：`http`（fetch 封装：baseURL / 自动带 token / 401 跳登录 / 超时 / 统一错误）+ `uploadFile()`（multipart，浏览器自带 boundary，不手写 Content-Type）。
- `utils/iconCache.ts`：书签图标描述缓存（localStorage，key `veythcog:nav-icons:v1`）；按图标字段签名失效 + 30 天 TTL + 300 条上限；只缓存地址不缓存图片字节。
- `api/sse.ts`：通用 `streamChat()`（OpenAI 兼容 /chat/completions，原生 EventSource 不能带 header 故用 fetch 手动解析）。
- `api/chat.ts`：`sendMessage()` 同步 + `streamChatMessage()` 流式（`/chat/stream`，携带 `docIds` / `compressEnabled`、解析 `event: references` → `onReferences`、支持 AbortController 中断；非 SSE 的 JSON 错误会解析 message 交给 `onError`）；会话列表 / 历史消息 / 删除 / **会话配置（`createConversation` → POST `/chat/sessions`、`updateConversation` → PUT）** 均走后端，**已无 mock 会话数据**。
- `api/auth.ts` / `llm.ts` / `knowledge.ts`：已接真后端；`admin.ts`：用户 / 模型目录 / 系统监控已接真，审计 / 系统配置 / 定时任务仍 mock。

### 7.3 Zustand stores（6+1，全部 persist）
`authStore`(token/用户/飞书) · `settingsStore`(模型绑定列表+当前模型+流式开关+毛玻璃) · `chatStore`(会话列表/流式增量) · `knowledgeStore` · `dbStore` · `toolTabsStore`。

> ⚠️ `chatStore` 虽为 persist 且实现了 `appendMessage/appendDelta`，但**聊天页未接入**（页面用 `useState`，会话列表与历史消息改由 `GET /chat/conversations` 拉取）；`knowledgeDocIds` 与会话模型绑定仍只在前端内存，刷新即丢。

> 注意：`settingsStore.providers`（本地供应商 CRUD）已演进为**从后端拉取绑定模型**（P0 改造），`doc/README.md` 该节描述偏旧。

### 7.4 交互约定（操作无感）
- 列表/详情的**变更后同步**一律用「静默刷新」：`loadDocs({ silent: true })` 不切 `loading`，只在原列表上原地更新；禁止保存、向量化、删除后触发整块 `<Spin />` 替换。
- 保存 / 向量化只做**本地乐观更新**（改 `detail` 元信息与列表项标记），不重拉详情——重拉会让 `DocEditor` 重解析 `blockData`，造成内容闪动与光标丢失。
- 同一文档重复点击不重新拉取（`selectDoc` 内置去重），避免无意义 loading。
- **切换明细/详情时不清空当前内容**：保留上一条内容继续显示，只在右上角显示细进度条（`vc-slim-progress`，见 `styles/global.css`）；禁止整块 `<Spin />` 替换。加载期间禁用保存 / 向量化 / 导出 / 删除，避免误操作到上一篇文档。
- 以上为**全站前端通用规范**，新开发的列表、详情、表单页一律遵循。

### 7.4 会话模型绑定策略（生产策略，已实现）
新建会话可选模型并写入 `chat_session.vendor_code/model_code`；进入已有会话后**下拉禁用**（会话内禁切）。会话的模型 / 知识库文档集合 / 上下文压缩开关都持久化在后端，刷新不丢；`docIds` 或压缩开关改动即时 PUT。无有效模型（未绑定、非对话类型或未通过校验）→ 空态引导去模型配置页逐行校验。

### 7.5 其他已落地
- **模型配置页（2026-11-13 重构）**：供应商卡片内「多选模型 + 编辑 AK + 默认模型」一次保存（`POST /llm/bindings/batch`）；AK 输入框密码态、脱敏占位（`sk-a****7890`）、留空不改、`清除我的 AK` 回落系统兜底；保存/清除走静默刷新 + 卡片顶部 2px 细进度条，不整块 Spin。2026-11-13 二次改造：改为**逐行单模型校验**（`POST /llm/models/{vendor}/{modelCode}/verify`，可携带当前草稿 AK），**不要求先绑定**；校验通过的模型标「已验证 · 待绑定」，用户再自行勾选保存。每个模型显示类型图标与类型标签（文本 / 推理 / 多模态 / 全模态 / 图像 / 视频 / 语音 / 向量）。失败弹窗给出原因（401 Key 无效 / 403 额度或权限 / 404 模型不存在 / 429 限流 / 超时）；校验记录按「用户 + 模型 + Key 指纹」落库，换 AK 自动失效。
- **对话页（2026-11-13 P0 收口）**：模型下拉只出现「已绑定 + 已通过校验 + 类型可对话（text/reasoning/vision/omni）」的模型，每个选项带类型图标；新建会话立即落 `chat_session`，重命名 / 知识库文档范围 / 「压缩」开关都写回后端；输入区左侧新增压缩开关（默认开），可会话级关闭。
- **系统管理 · 模型目录页（2026-11-13 接真）**：`Admin/Models.tsx` 原为前端 mock，现接 `/admin/llm-models`；表格按供应商分组展示、支持全部/已上架/未上架筛选 + 关键字搜索（模型名/编码/供应商）、上架开关、编辑（已绑定模型锁定供应商与编码）、删除（有绑定则禁用并提示）、新增、从供应商同步（弹窗选供应商 + 是否直接上架，结果弹窗列出新增编码）。列表撑满父容器剩余高度、**取消分页改为表头固定 + 表体内部滚动**（数据全在前端，109 行级别无需请求分页），变更后静默刷新 + 顶部细进度条。二次改造：新增**类型列**（图标 + 类型标签）；新增/编辑表单可选模型类型；同步不再过滤非文本模型，并按供应商 capabilities 保存类型。
- 导航首页（`/home`，对标 iTab）：分类竖栏 + 书签网格 + 壁纸；`BookmarkModal` 按 iTab「自定义图标」重做，支持「获取图标 / 上传图片 / 文字图标 + 12 色板 / 保存并继续」；`BookmarkIcon` 先查 localStorage 图标缓存，未命中再 `GET /nav/bookmarks/{id}/icon`，不再实时拼对方站点 favicon；进入首页延后 1.5s 触发一次 `POST /nav/icons/sync`（后端幂等 + 失败冷却）。
- 主题系统：6 预设 × 亮暗 + **全局毛玻璃开关**（CSS 变量 + inline style 双轨）。
- 浮动音乐播放器（`FloatingMusicPlayer`，真 `<audio>`，mock 歌单）。
- 可折叠侧栏（`CollapsibleSidebar`，物理裁剪把手，persist）。
- 工具集：24+ 工具（`registry.tsx` 注册表，React.lazy 独立分包，多标签保留状态）。
- **系统管理 · 系统监控页（2026-11-13 接真）**：`Admin/Monitoring.tsx` 由三块 mock 改为真实数据面板——概览卡（调用量 / 失败率 / P95 / Token / 在线会话 / LLM 调用）、调用趋势（24h 按小时、7d 按天，柱高=调用量、柱顶红字=错误数）、服务资源（系统/进程 CPU、物理内存、JVM 堆、磁盘、Swap、线程/运行时长）、接口排行（可按调用量/错误数/P95 切换）、LLM 用量（按供应商+模型）、在线会话（强制下线，Popconfirm）、最近错误（业务码/HTTP 状态/message/rid）。60s 自动静默刷新 + 手动刷新，首次加载才整块 Spin；`admin.ts` 对应函数在 bypass 模式仍返回本地假数据，其余走 `/admin/monitor/*`。
- Admin 后台：`/admin/*` 中用户/角色、模型目录、系统监控已接真；审计、系统配置、定时任务仍 mock，role 由登录响应下发。

---

## 8. 配置与启动

### 8.1 后端
- 配置文件：`vc-app/src/main/resources/application.yml`（通用）+ `application-local.yml`（**本地环境，已被 .gitignore 忽略，不入库**）。
- **当前 active：PostgreSQL（个人服务器 docker 容器，连接串在 application-local.yml）**；`docs/architecture.md` 记的"MySQL 先行"已过时。
- 导航图标同步：`nav.icon.sync-on-startup`（默认 `true`）控制启动时后台补同步，离线演示可设 `false`；单次上限 200 条，2 线程守护池，失败按 1 天冷却。
- **安全红线**：`application-local.yml` 含**真实 DashScope AK 与数据库密码，严禁写入任何文档/提交 Git**；密钥一律环境变量注入（`DASHSCOPE_API_KEY` / `DEEPSEEK_API_KEY` / `JWT_SECRET` / **`LLM_KEY_AES_SECRET`** / DB 密码）。
- **用户自持 Key（2026-11-13）**：模型配置页按供应商录入并多选模型，Key 经 AES-256-GCM 加密存 `user_llm_binding.api_key_cipher`；调用时**用户 Key 优先，配置文件 AK 兜底**。加密口令 `LLM_KEY_AES_SECRET` 只走环境变量，**丢失后已存用户 Key 无法解密**（需用户重填）。未配置口令时应用可正常启动，仅保存/解密报 50000。校验与绑定解耦：`POST /llm/models/{vendor}/{modelCode}/verify` 可用尚未保存的草稿 AK 校验，结论存 `user_llm_model_verify` 并绑定 Key 指纹。
- **百炼地域 / 业务空间（2026-11-13）**：`llm.vendors.dashscope.workspace-id` / `region` 为服务端兜底（默认 `cn-beijing`）；用户在模型配置页保存的值优先，存 `user_llm_binding.workspace_id/region`。有 workspace 时调用 `https://{workspace}.{region}.maas.aliyuncs.com`，无 workspace 时走标准域名或配置 `base-url`（自动去 `/compatible-mode` 后缀）；workspace/region 进入域名前做白名单校验。
- AK 全缺失时：可绑定但对话报「该模型未配置密钥」（`ErrorCode.SYSTEM_ERROR`）。
- **启动（唯一推荐方式，后端+前端一条命令）**：`pwsh VeythCog-C/scripts/dev.ps1`，或双击 `VeythCog-C/scripts/dev.cmd`，或在 Trae 里跑任务 `dev: 后端+前端`（`tasks.json` 已内置，Ctrl+Shift+P → Tasks: Run Task）。
  脚本固定流程：① **先释放端口**（8123 / 3000 上有旧进程就先 Stop-Process，确认端口真空了才继续）→ ② mvn 打包（默认离线，`-Online` 联网）→ ③ 打包失败立即中止，绝不启动旧 class → ④ 后端 `java -jar` 起在后台（日志 `vc-app/target/dev-logs/backend.log`）→ ⑤ 前端 Vite 前台跑在 3000。
  子命令：`dev.ps1 backend`（只后端，前台）、`dev.ps1 frontend`（只前端）、`dev.ps1 stop`（只释放 8123/3000）。
  常用参数：`-SkipBuild`（纯重启，秒级）、`-BackendPort 8124 -FrontendPort 3001`（另起一份做冒烟，不占主端口）、`-JdkHome`（强制指定 JDK）。
- **本机 JDK 现状（2026-11-12 复核）**：`I:\` 盘当前不存在（旧记录里的 `I:\Java\jdk-21` 读不到），`JAVA_HOME` = `D:\Java\jdk1.8.0_202`（Java 8，**不能用于本项目**）；机器上唯一的 JDK 21 是 IDE 下载的 `C:\Users\ext.chenjie155\.jdks\ms-21.0.12.1`（21.0.12.1）。脚本已改成自动发现，这种「版本对但路径不在老列表里」的情况不会再漏。
- **JDK 版本以项目配置为准（不再写死路径）**：所需版本取自 `VeythCog-C/pom.xml` 的 `<java.version>`（当前 21；缺省才退回 `maven.compiler.release/source/target`），可用 `-JavaVersion` 临时覆盖。JDK 目录按来源优先级自动找：`-JdkHome` → `scripts\jdk.path`（可选，一行目录，换机器/换盘时不用改脚本）→ `VEYTH_JAVA_HOME` → `.vscode\settings.json` 的 `java.jdt.ls.java.home` / `java.configuration.runtimes` → `.idea\misc.xml` → `JAVA_HOME` → 注册表 `JavaSoft` → 常见安装目录扫描（`D:/E:/I:/C:\Java`、`C:\Program Files\Java|Eclipse Adoptium|Microsoft|Zulu|Amazon Corretto|BellSoft|JetBrains`、`%USERPROFILE%\.jdks`、`%LOCALAPPDATA%\Programs`、`scoop`、Toolbox）→ PATH 上的 `java`。
  挑选规则：**版本完全一致优先**；没有就用最近的更高版本并黄字提示；只有更低版本时直接中止并列出扫到的 JDK（含来源）。候选必须是真 JDK（同时有 `bin\java.exe` 与 `bin\javac.exe`，`jre1.x` 会被排除）。选定后**回写 `$env:JAVA_HOME`**，保证 mvn 与 java 同一套；`1.8.0_202` 这类老版本号会归一成 `8`。启动前仍会比对 `VcAppApplication.class` 的 major 与运行 JDK，不一致直接中止并提示 `mvn clean` 重编。
- **JDK 必须 21（坑在这里）**：class 是 Java 21 编的（class major=65），拿 JDK 17（61）跑就报 `UnsupportedClassVersionError`；脚本启动时会打印 `项目 JDK = Java 21（来自 pom.xml <java.version>）`、`JDK = <路径> (Java 21，来源：…)`、`JAVA_HOME = …`，想核对当前用哪套看这三行。
- **为什么不再直接在 IDE 里 Run（血泪教训，同类问题已复发 3 次）**：Trae / VS Code 的 Java 扩展跑 `com.vc.app.VcAppApplication` 时，classpath 直接指向各模块 `target/classes`；增量编译没跑成或编译失败时，进程照样启动并加载**上一版旧 class**（`java.debug.settings.onBuildFailureProceed` 为 true 时更隐蔽）。症状是「代码明明改了却不生效」：新增接口 404、`/nav/wallpaper/thumb` 已 permitAll 仍 401、返回值还是旧的，而 IDE 控制台一声不响。
  判断是否踩坑：比对源码 mtime 与 `vc-app/target/classes/**/*.class` 的 mtime（脚本每次启动会打印 jar 与最新源码时间，jar 早于源码会黄字告警）。
  仓库根 `.vscode/settings.json` 已开 `java.autobuild.enabled`、关 `java.debug.settings.onBuildFailureProceed`（`.vscode/settings.json` 与 `tasks.json` 已从 .gitignore 放行，随仓库生效）。
- 种子账号：`admin / admin123`，默认绑定 `dashscope/qwen-plus`。
- **监控配置（2026-11-13）**：`monitor.*` 在 `application.yml`（保留天数、采集队列容量、会话空闲阈值、资源采样开关）；`VcAppApplication` 已加 `@EnableScheduling` 供 `MonitorRetentionJob` 每日 03:30 清理。监控表脚本 `docs/sql/016_observability.sql`（开发库已执行，输出 `OK executed=19`）。

### 8.2 前端
- `.env.development`（已提交）：`VITE_API_BASE=http://localhost:8123/api`（与后端 8123 对齐，2026-11-09 修正原 8080 错配）；`.env.production` 指向 `https://api.veythcog.top/api`；`src/config/index.ts` 兜底默认 8123。
- 登录页「运行模式」默认收起并走真实后端（`bypassMode=false`）；展开后单选切换 mock/真实，可临时覆盖 apiBase（persist key `veythcog:mode:v3`）。⚠️ 改 `.env` 后需重启 dev server（Vite 不热更 env）。
- 启动：用统一脚本 `VeythCog-C/scripts/dev.ps1`（`all` 默认带前端；只想起前端用 `dev.ps1 frontend`）；脚本会先释放 3000 上的旧 Vite 再起，node_modules 缺失时自动 `npm install`。构建：`npm run build`（tsc + vite）。

### 8.3 数据库
- `docker-compose.yml`：`pgvector/pgvector:pg16`（个人服务器 docker 容器，单库两用，已启用 pgvector 扩展）。
- `ddl-auto=none`：新表需手动执行 `docs/sql/*.sql`（`chat_message` 建表后记忆才生效）。
- 知识库脚本（唯一权威，按序执行）：`009_knowledge.sql`（建表，已不含 `lib_type`）→ `010_knowledge_v0.3_migration.sql`（旧库补 `embedding_model` 列 + IVFFlat 索引）→ `011_knowledge_remove_libtype.sql`（**物理删除**历史 `lib_type` 列，幂等）。⚠️ 旧库缺 010 则向量化报「`embedding_model` 列不存在」；011 新版需**重跑一次**才会真正删列（个人服务器库已跑过旧版 011，只置了默认值）。`openspec/sql/knowledge-init.sql` 已废弃，勿再使用。
- 监控脚本：`016_observability.sql`（`sys_api_sample` / `sys_api_metric_minute` / `llm_call_log` / `sys_user_session` 四表，幂等）。本机无 psql 时可用 JDK 单文件 `ApplySql.java`（读 `DB_URL/DB_USER/DB_PASS`，按 `;` 拆分执行）。
- 模型类型与校验脚本：`018_model_type_and_verify.sql`（`llm_model.model_type` + `user_llm_model_verify` 表、唯一索引，幂等）。开发库已执行（`OK executed=7`）。存量绑定旧的 `is_valid` 不迁移，需在模型配置页重新逐行校验。
- 业务空间脚本：`019_llm_workspace_region.sql`（`user_llm_binding.workspace_id/region` + `(user_id,vendor_code,workspace_id)` 索引，幂等）。开发库已执行（`OK executed=5`）。旧校验记录为 key-only 指纹，升级后需重新校验。
- 多模态脚本：`020_llm_model_modalities.sql`（`llm_model.modalities` + 按 `model_type` 回填，幂等）。开发库已执行（`OK executed=3`，373 行全部有值）。

---

## 9. OpenSpec 开发流程（`agent.md` 为权威）

核心循环：**propose → review → apply → archive**。
- 非琐碎变更：先在 `openspec/changes/<feature>/` 写 `proposal.md` / `specs/*.md`（行为+验收）/ `design.md`（接口契约）/ `tasks.md`（原子任务）。
- **必须人工 review 确认后才 apply**；apply 严格按 design 的目录结构/接口签名/schema；完成后把 specs delta 合并回长期文档并归档。
- 硬性约束：契约先行、前后端解耦；API Key 不落前端；端口 8123/3000；前端不感知厂商差异（收敛后端网关）；会话模型绑定；防烂尾（每阶段≤3 周）。
- 质量门：编译通过 + 真实运行验证核心链路（登录→查模型→发消息→收回复）+ 数据可复核 + 状态单一权威 + 缺口披露。

---

## 10. 当前状态快照与待办

**已打通（可演示）**：真 JWT 登录（账号密码；微信扫码登录已移除）→ 模型绑定管理（**用户自持 AES 加密 Key + 配置兜底**，2026-11-13）→ 同步对话 + **SSE 流式对话**（带 JDBC 会话记忆、可中断）；RAG 知识库 P0（文档 CRUD/导入导出/向量化/RAG 召回/**后端注入 prompt + 引用下发** + `DocEditor`（基于 BlockNote）文档编辑器 + 对话侧引用卡片）；已去除「私有库/演示库」概念（`lib_type` 列已删）；导航首页 P2 图标资产化 + iTab 备份导入（2026-11-12：`nav_bookmark` 共 267 条，238 条 upload、18 条 text、11 条 auto；S3 `public-icons` 245 个唯一图标对象被引用、247 条书签引用，直链 HEAD 全部 200；70 个 SVG 半图已用“2 倍窗口截图 + 透明包围盒裁剪”重刷修复）。

**已知阻塞**：
- DashScope 免费额度曾耗尽（403 FreeTierOnly），需充值或换有效 AK 才能拿真实回复；DeepSeek AK 待填。**因此当前模型多数无法通过真实连通校验，对话被 40000 拦截；本轮已验证「未绑定 + 草稿 AK 校验」「无 AK 兜底提示」「绑定但未校验拦截」三条路径，真实成功回复与上下文压缩摘要成功路径仍需有效 Key 回归。**
- ~~旧库需补跑 010/011~~ ✅ 个人服务器库已执行（2026-11-09 确认），写入链路打通。
- 导航图标剩 2 条无图：`baomidou.com`（MyBatis-Plus，仅 SVG，按安全策略拒绝）、`translate.google.com`（Google 翻译，当前网络不可达），前端文字兜底。iTab 导入中的 Stack Overflow / VeythCog / 技术文章摘抄 / 激战2中文维基已补齐 S3 图标；莫娜占卜铺站点连接被重置，保留文字图标。
- SVG 图标半图问题已修复：根因是 Windows 高 DPI 下 Chrome 无头截图 CSS 视口只有窗口一半；转换器已改为 2 倍窗口 + alpha 包围盒裁剪 + `--headless=new` 超时回退旧 `--headless`。70 个 SVG 项已全部重刷，S3 直链复查 247/247 200。

**待办/演进**（源自架构文档 + 现状）：
1. ~~会话元数据持久化~~ ✅ 2026-11-13 已完成（`chat_session` + 前后端会话配置；`chatStore` 仍未接入，页面用 `useState`）。
2. ~~RAG 知识库实现~~ ✅ 已完成 P0；**RAG 引用已收归后端**（`RagChatOrchestrator` 检索 + 注入 prompt + SSE `event: references`，前端不再自行 retrieve）。P1 待办：① 文档更新时清理旧向量（当前只置 `is_vectorized=false`，检索端已过滤，旧向量仅占空间）；② 批量向量化/移动/打标；③ `importMd` 的 md→block 结构与 BlockNote 块结构对齐（当前靠前端降级解析）；④ `vectorize` 长事务拆分、`dimensions` 校验、IVFFlat/阈值调参、单测；⑤ 辅助模型选型收敛（当前为可用性妥协的 `deepseek-v4-pro-0813`，带 reasoning 成本偏高），rerank 需补端到端回归与失败用例。
3. Admin 后台：用户/角色管理、**模型目录**、**系统监控**已接真后端（`/admin/users`、`/admin/roles`、`/admin/llm-models`、`/admin/monitor/*`）；审计/系统配置/定时任务仍 mock。
   - 监控口径（2026-11-13 已定）：存储 ③双写（`sys_api_sample` 明细 + `sys_api_metric_minute` 分钟桶）；会话 ②会话表 + JWT `sid`；Token ①供应商 usage 优先、缺失估算并标 `usage_source`。资源监控用 JDK MXBean，无额外依赖。
   - 已知取舍：明细保留期由 `monitor.retention` 控制（每日 03:30 清理）；P95 由分钟桶直方图估算，不做全量明细分位；LLM usage 在错误/中断调用上只能估算。
4. `role` 已随登录响应下发（`LoginResponse.role`，取多角色中的主角色）；暂无 `/auth/me` 接口，需重新拉取用户信息时再补。
5. ~~清理残留 MySQL 驱动~~ ✅ 已清理（全模块 pom 无 mysql 依赖）。
6. vc-learn 未提交改动整理（结构化输出实验）。
7. 同步各文档滞后点（见 §4 / §7.3 / §8.1）。
8. **P0 用户自持 Key 已落地（2026-11-13）**：AES-256-GCM 加密入库、供应商多选模型、配置兜底。**2026-11-13 收口三项**：① Key 连通校验 `is_valid` 门控（对话下拉过滤 + 后端 40000 拦截 + 换 AK 自动失效）；② `chat_session` 会话元数据（模型 / `ragDocIds` / 标题 / 压缩开关，软删除）；③ 上下文动态压缩（阈值 4000 token、保留 3 轮、摘要 system 消息、失败降级丢弃）。`openspec/llm-binding-prd.md` 仍剩：访客演示模型、SSE 协议 `delta/done` + 幂等 + 同会话并发锁、绑定表单 temperature/topP/备注、token 估算统一 `cl100k_base`（当前为 CJK 启发式）。
9. **模型目录管理已落地（2026-11-13）**：`/admin/llm-models` 增删改查 + 上下架 + 从供应商同步。实测百炼 `/api/v1/models` 返回 373 个模型、其中 108 个具备 TG（文本生成）能力；DeepSeek 的 `/models` 需要该供应商 AK，而当前配置 `deepseek.api-key` 为空，同步会返回 40000 提示先配 AK。同步为「只增不删、新增默认不上架」，避免误删用户绑定。
10. **百炼地域 / 业务空间已落地（2026-11-13）**：`019` 迁移 + `DashScopeEndpoint` / `LlmEndpointService`；workspace/region 按「用户 + 供应商」保存，系统配置兜底；校验（含多模态）和实际对话均按生效地址调用，复合指纹换 Key/换空间即失效。实测华北2 `llm-j09pwqdqv4no16ww`：`qwen3-vl-plus` 多模态校验与 `qwen-max` 真实对话均通过；标准域名同样可用（业务空间不是硬性前提）。已同步改造管理端「从供应商同步」走生效地址。**已知限制**：`vision` 模型虽在对话下拉中，但 Spring AI DashScope 文本生成路径对 `qwen3-vl-plus` 返回 `url error`（标准域名同样），纯文本模型正常；视觉模型对话入口需后续接多模态生成路径。

---

## 10.1 权限决策（2026-11-09）

- **本阶段不做按用户隔离**：知识库接口仅要求登录，文档为全账号共享数据；单账号自用场景可接受。
- 用户级赋权**计划通过统一中间件**实现（非本模块内建），中间件落地后本模块只消费其授权结果。
- 因此评审中「`owner_id` 缺失 / 越权读写」**不作为缺陷处理**，也不在 P0/P1 计划内；多账号上线前必须由中间件补齐，否则文档互相可见。
- **RAG 引用归属（2026-11-09）**：检索、上下文注入、引用产出全部在后端完成；前端只传 `docIds`、只消费 `references`。不同场景复用同一份召回结果，杜绝「展示的引用 ≠ 模型读到的资料」。
- **`lib_type` 处置（2026-11-09）**：`009` 不再建该列，`011` 改为 `DROP COLUMN IF EXISTS`（旧库重跑即删列）。列内历史取值均为 `private`，无业务语义，删除不可逆但不影响读写。

---

## 11. 迭代维护规则（给未来 Agent）

每次在本仓库做变更（结构/接口/库/模块/配置/流程）后，**必须在 `PROJECT_MEMORY.md` 同步**：
1. 更新受影响章节（§3 模块、§4 状态矩阵、§5 表结构、§6 接口、§8 配置）。
2. 保持「记忆文档 = 代码现状」，若与 `docs/architecture.md` / `doc/README.md` 冲突，以**代码与本文档**为准，并顺手修订旧文档或标注滞后。
3. 把「信息基准」日期更新为当天。
4. **绝不写入真实密钥 / 数据库密码 / 个人敏感信息**。

---

## 12. 安全约束（重申）

- 真实 AK（DashScope/DeepSeek）/ `LLM_KEY_AES_SECRET` 与数据库凭证只存 `application-local.yml`（已 gitignore）或环境变量，不得出现在任何提交文件或本记忆文档。
- 前端任何层**不持久化** API Key：只在配置页表单内瞬时持有并随请求提交，不写 localStorage / sessionStorage / 日志；后端以 AES-256-GCM 加密后入库，响应只回脱敏值。
- 本记忆文档不含任何密钥、口令、令牌。
