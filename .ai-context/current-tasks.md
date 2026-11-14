# 当前任务分配表（current-tasks.md）

> 用途：记录「谁（Agent）、做什么、状态、输出文件、依赖」。每次任务启动/完成/受阻时更新本表，并在 `change-log.md` 追加变更记录。
> 状态枚举：`待认领` / `进行中` / `已完成` / `受阻` / `已取消`。

## 1. 活跃任务（知识库模块 P0）

| 任务ID | 负责Agent | 任务内容 | 状态 | 输出文件 | 依赖/前置 |
|---|---|---|---|---|---|
| KB-01 | JoyCode | 后端：`knowledge_doc`/`knowledge_embedding` 实体 + Repository（JPA） | 已完成 | `vc-knowledge/.../entity/KnowledgeDoc.java`、`repository/KnowledgeDocRepository.java` | 执行 `openspec/sql/knowledge-init.sql` |
| KB-02 | JoyCode | 后端：文档 CRUD + 导入导出 + 关键词检索 Service/Controller | 已完成 | `vc-knowledge/.../service/KnowledgeService*.java`、`vc-app/.../web/KnowledgeController.java` | KB-01 |
| KB-03 | JoyCode | 后端：向量化/取消向量化/RAG 召回（EmbeddingModel + pgvector `<=>`） | 已完成 | `vc-knowledge/.../service/VectorizeService*.java` | KB-01；Embedding 模型/维度已核查 |
| KB-04 | JoyCode | 后端：访客只读演示库（SecurityConfig 放行 + 写接口 403 校验） | 已完成 | `vc-app/.../config/SecurityConfig.java` | KB-02 |
| KB-05 | JoyCode | 前端：知识库总览/编辑器/导入导出页切真实接口 | 已完成 | `VeythCog-V/src/pages/Knowledge/index.tsx`、`src/api/knowledge.ts`、`src/types/index.ts` | 契约 `openspec/api-spec.md` |
| KB-06 | JoyCode | 前端：块编辑器（P0 用 Markdown 编辑器 + 预览替代 BlockNote，BlockNote 依赖 P1 再接入） | 已完成（降级） | `VeythCog-V/src/pages/Knowledge/index.tsx` | 未新增 `@blocknote/*` 依赖 |
| KB-07 | JoyCode | 前端：AI 对话侧知识库选择抽屉 + RAG 引用卡片 | 已完成 | `VeythCog-V/src/pages/Chat/index.tsx` | KB-03、KB-05 |
| KB-08 | JoyCode | 后端：知识库 DB 层重构为 MyBatis-Plus + pgvector（自定义切片/EmbeddingProvider/L2 检索/IVFFlat/embedding_model） | 已完成 | `vc-knowledge/.../entity|mapper|handler|config|embedding|splitter|service`、`application.yml`、根 `pom.xml` | KB-01~03；已编译通过 |

## 2. 已完成任务（文档规范化，本次会话）

| 任务ID | 负责Agent | 任务内容 | 状态 | 输出文件 | 依赖/前置 |
|---|---|---|---|---|---|
| DOC-01 | JoyCode | 扫描代码库并评审知识库 PRD 可行性 | 已完成 | 对话结论 | — |
| DOC-02 | JoyCode | 优化 PRD（v0.1→v0.2，修正向量维度/中文检索/软删除等） | 已完成 | `openspec/knowledge-prd.md` | DOC-01 |
| DOC-03 | JoyCode | 输出 API 契约 | 已完成 | `openspec/api-spec.md` | DOC-02 |
| DOC-04 | JoyCode | 输出建表 SQL（含 pgvector 扩展/IVFFlat L2/中文索引/embedding_model） | 已完成 | `openspec/sql/knowledge-init.sql` | DOC-02 |
| DOC-05 | JoyCode | 建立 `.ai-context/` 协作文档（global-rule/current-tasks/change-log） | 已完成 | `.ai-context/*` | DOC-01~04 |

## 3. 待办/阻塞

- **环境事实（已确认）**：① Embedding 维度 `1024`（qwen3.7-text-embedding-flash）；② 目标库已迁到个人服务器 docker 容器，pgvector 扩展已启用；③ datasource 为个人服务器 docker（非 Supabase 云端）。
- **依赖已补齐**：后端 `vc-knowledge/pom.xml` 已加 `spring-ai-alibaba-starter-dashscope` + `mybatis-plus-spring-boot3-starter` + `postgresql` + `spring-boot-starter-validation`；MyBatis-Plus 版本锁定 3.5.7。
- **DB 迁移待执行**：`knowledge_embedding` 新增 `embedding_model` 列、向量索引改为 IVFFlat L2；已建库请执行增量脚本 `openspec/sql/knowledge-migrate-v0.3.sql`（全新建库用 `knowledge-init.sql`）后才生效。
- **P1 待办（非阻塞）**：① 前端 BlockNote 块编辑器接入（P0 用 Markdown 编辑器 + 预览替代，未加 `@blocknote/*` 依赖）；② 批量向量化/移动/打标接口；③ 会话元数据持久化。
- **真实运行验证待做**：需启动后端 + 前端，跑通「登录 → 文档 CRUD → 向量化 → RAG 召回 → 对话引用」核心链路；`application-local.yml` 的 datasource 指向个人服务器 docker，需确认可达。

## 4. 导航图标 P2（2026-11-12）

| 任务ID | 负责Agent | 任务内容 | 状态 | 输出文件 | 依赖/前置 |
|---|---|---|---|---|---|
| NAV-01 | MainAgent | 库迁移：`nav_bookmark` 补 5 个图标列 + CHECK 约束 | 已完成 | `VeythCog-C/docs/sql/013_nav_bookmark_icon.sql`、`012_nav.sql` | 012 已执行 |
| NAV-02 | MainAgent | 后端：图标抓取/上传/解析/同步 + 接口 | 已完成 | `vc-nav`（entity/dto/service）、`vc-app/web/NavIconController.java`、`NavBookmarkController.java`、`application.yml` | `vc-common` S3 封装 |
| NAV-03 | MainAgent | 前端：弹窗重做 + 缓存优先图标加载 + multipart | 已完成 | `VeythCog-V/src/{api/client.ts,api/nav.ts,utils/iconCache.ts,pages/Home/*}` | 后端接口 |
| NAV-04 | MainAgent | 构建与端到端验证 | 已完成（缓存命中未浏览器实测） | `openspec/changes/p2-nav-icons/tasks.md`、`design.md §7` | NAV-02/03 |
| NAV-05 | MainAgent | 文档同步 | 已完成 | `PROJECT_MEMORY.md`、`.ai-context/change-log.md` | NAV-04 |
| NAV-06 | MainAgent | iTab 备份分析导入：容错解析、URL 去重、SVG/ICO 转 PNG、S3 上传、书签合并、失败恢复与直链校验 | 已完成 | `VeythCog-C/scripts/import_itab_backup.py`、`.ai-context/itab-import-2026-11-12/*` | NAV-02 |
| NAV-07 | MainAgent | 半图图标修复（Chrome 2 倍窗口 + alpha 裁剪，70 个 SVG 重刷）、首页书签区宽度 66.6667vw、线上同步脚本与 README | 已完成 | `.ai-context/itab-import-2026-11-12/report.md`、`VeythCog-V/src/pages/Home/BookmarkGrid.tsx`、`VeythCog-C/scripts/README-nav-import.md` | NAV-06 |
| NAV-08 | MainAgent | SQL 入库脚本（7 分类/267 书签，幂等插入 + 同 URL 图标同步）；修复图标缓存命中后仍请求后端的问题 | 已完成 | `VeythCog-C/docs/sql/014_nav_itab_data.sql`、`README-014-nav-data.md`、`VeythCog-V/src/pages/Home/BookmarkIcon.tsx` | NAV-07 |

## 5. 用户自持加密 Key（2026-11-13）

| 任务ID | 负责Agent | 任务内容 | 状态 | 输出文件 | 依赖/前置 |
|---|---|---|---|---|---|
| KEY-01 | MainAgent | 变更文档：proposal / specs / design / tasks | 已完成 | `openspec/changes/p0-user-llm-key/*` | 用户拍板「用户自持加密 Key，配置兜底」 |
| KEY-02 | MainAgent | 库迁移：`user_llm_binding` 加 `api_key_cipher` / `api_key_updated_at` 并执行 | 已完成 | `docs/sql/015_user_llm_binding_api_key.sql` | 开发库 `vector_test` |
| KEY-03 | MainAgent | 后端：AES-256-GCM 加解密/脱敏、批量绑定、改/清 Key、路由用户 Key 优先 + 配置兜底、缓存按指纹、DashScope 动态实例 | 已完成 | `vc-llm/{crypto,config,entity,service,router,factory,dto}`、`vc-app/{LlmModelController,BatchBindRequest,ApiKeyRequest,GlobalExceptionHandler}` | KEY-02 |
| KEY-04 | MainAgent | 前端：供应商卡片多选模型 + AK 编辑/清除 + 默认模型 + 静默刷新 | 已完成 | `VeythCog-V/src/{api/llm.ts,types/index.ts,pages/Settings/Providers.tsx}` | KEY-03 |
| KEY-05 | MainAgent | 编译与接口验证（临时端口 8125，验证后已停） | 已完成 | `openspec/changes/p0-user-llm-key/design.md §5` | KEY-03/04 |
| KEY-06 | MainAgent | 文档同步 | 已完成 | `PROJECT_MEMORY.md`、`.ai-context/change-log.md`、本表 | KEY-05 |

> 验证记录（2026-11-13）：用户 Key 保存后目录返回 `sk-d****7890` 且无明文；用 dummy Key 对话返回上游 401 InvalidApiKey（证明用户 Key 优先）；清除后回落配置 AK（返回 403 FreeTierOnly，鉴权通过、额度不足）；密文落库 65 字符 `base64(iv):base64(ct)`、库内无明文；空 vendor / 空 message 均返回 `{code:40000}`。

## 6. 模型目录管理（2026-11-13）

| 任务ID | 负责Agent | 任务内容 | 状态 | 输出文件 | 依赖/前置 |
|---|---|---|---|---|---|
| MDL-01 | MainAgent | 实测供应商模型列表接口（百炼原生 373/108 TG、兼容模式、DeepSeek 需 AK） | 已完成 | `openspec/changes/llm-model-catalog-admin/proposal.md §实测` | 本地 config AK |
| MDL-02 | MainAgent | 后端：`/admin/llm-models` CRUD + 上下架 + 同步 + 绑定保护 | 已完成 | `vc-app/web/AdminLlmModelController.java`、`vc-llm/service/LlmCatalogAdminService.java`、DTO/请求体 4 个、两个 Repository 方法 | MDL-01 |
| MDL-03 | MainAgent | 前端：模型目录页由 mock 改真实接口（表格/筛选/CRUD/同步/静默刷新） | 已完成 | `VeythCog-V/src/api/adminModels.ts`、`src/pages/Admin/Models.tsx` | MDL-02 |
| MDL-04 | MainAgent | 编译 + 接口验证（临时 8125，验证后清理 107 条同步行并停服） | 已完成 | `openspec/changes/llm-model-catalog-admin/design.md §5` | MDL-02/03 |
| MDL-05 | MainAgent | 文档同步 | 已完成 | `PROJECT_MEMORY.md`、`.ai-context/change-log.md`、本表 | MDL-04 |

> 验证记录（2026-11-13）：新增/编辑/下架/删除均 200；重复编码 40000；删除有绑定模型 40000、改其编码 40000；DeepSeek 无 AK 同步 40000；百炼同步 `total=108 / added=107 / skipped=1`，新增行未上架；清理后目录恢复 2 行、qwen-plus 仍为默认。



## 7. 系统监控 / vc-admin（2026-11-13）

| 任务ID | 负责Agent | 任务内容 | 状态 | 输出文件 | 依赖/前置 |
|---|---|---|---|---|---|
| MON-01 | MainAgent | 建 `vc-admin` 模块 + 4 张监控表迁移并执行 | 已完成 | `VeythCog-C/vc-admin/pom.xml`、`docs/sql/016_observability.sql` | 用户拍板③双写/②会话表/①usage 优先 |
| MON-02 | MainAgent | 接口采集 + 分钟桶聚合 + LLM usage + 业务码 Advice | 已完成 | `vc-admin/monitor/{MetricsCollector,LlmCallRecorderImpl}`、`vc-app/web/{ApiAccessLogFilter,BizCodeAdvice}.java`、`vc-llm/router/LlmModelRouter.java` | MON-01 |
| MON-03 | MainAgent | 会话表 + JWT sid + 登录/登出/踢人 | 已完成 | `vc-admin/monitor/{entity,repository,service}`、`vc-app/auth/**` | MON-01 |
| MON-04 | MainAgent | 查询接口 + 资源监控 + 清理任务 | 已完成 | `vc-admin/monitor/{MonitorQueryService,ResourceMonitor,MonitorRetentionJob,web/AdminMonitorController}` | MON-02/03 |
| MON-05 | MainAgent | 前端监控页接真实数据 + 类型/API | 已完成（`npm run build` 通过） | `VeythCog-V/src/{types/index.ts,api/admin.ts,pages/Admin/Monitoring.tsx}` | MON-04 |
| MON-06 | MainAgent | 编译/bootstrap 与接口验证（8125，验证后停服） | 已完成 | `vc-app/target/run-8125-monitor.log` | MON-04/05 |
| MON-07 | MainAgent | 文档同步 | 已完成 | `PROJECT_MEMORY.md`、`.ai-context/change-log.md`、本表 | MON-06 |

> 验证记录（2026-11-13）：`mvn -o -q -pl vc-admin,vc-app -am -DskipTests compile` EXIT=0；overview `/auth/login` calls=1/p95=479；errors 捕获 `chat/message` 上游 403（bizCode=50000、HTTP 200、message 原文、rid）；llm 1 次失败、promptTokens 估算 1、latency 723ms；按 JWT sid 踢人后 token2=40100、token1=0；logout 后原 token=40100；resources 返回真实 CPU/内存/JVM/磁盘。
## 8. P0 收口三项（2026-11-13）

| 任务ID | 负责Agent | 任务内容 | 状态 | 输出文件 | 依赖/前置 |
|---|---|---|---|---|---|
| P0C-01 | MainAgent | 迁移 017：绑定校验列 + `chat_session` | 已完成（`OK executed=12`） | `VeythCog-C/docs/sql/017_p0_verify_and_session.sql` | 用户拍板 1/2/3 都做 |
| P0C-02 | MainAgent | 连通校验服务 + 接口 + 对话门控 + AK 变更失效 | 已完成 | `vc-llm/{service/LlmBindingVerifier,router/LlmModelRouter,service/LlmModelService,dto/VerifyResult}`、`vc-app/web/LlmModelController` | P0C-01 |
| P0C-03 | MainAgent | `chat_session` 实体/仓库/服务 + 会话配置接口 + 列表合并 | 已完成 | `vc-chat/{entity/ChatSession,repository,ChatSessionService,dto/ChatSessionVO}`、`vc-app/web/{ChatController,ChatSessionRequest}` | P0C-01 |
| P0C-04 | MainAgent | 上下文压缩器 + 配置 + 同步/流式接入 + 失败降级 | 已完成（降级路径已验证） | `vc-chat/compress/*`、`vc-chat/ChatService`、`vc-app/orchestration/RagChatOrchestrator` | P0C-03 |
| P0C-05 | MainAgent | SSE 已建流后的错误事件修正 + 前端非 SSE 错误解析 | 已完成 | `vc-app/web/ChatController`、`VeythCog-V/src/api/chat.ts` | P0C-04 |
| P0C-06 | MainAgent | 前端配置页校验状态/按钮；对话页会话持久化 + 压缩开关 | 已完成（`npm run build` EXIT=0） | `VeythCog-V/src/{api/llm.ts,api/chat.ts,types/index.ts,pages/Settings/Providers.tsx,pages/Chat/index.tsx}` | P0C-02/03 |
| P0C-07 | MainAgent | 编译 + 8125 接口验证（验证后停服） | 已完成 | `vc-app/target/run-8125-p0.log` | P0C-02~06 |
| P0C-08 | MainAgent | 文档同步 | 已完成 | `PROJECT_MEMORY.md`、`.ai-context/change-log.md`、本表 | P0C-07 |

> 验证记录（2026-11-13）：`mvn -o -q -pl vc-chat,vc-llm,vc-app -am -DskipTests compile` EXIT=0；verify 对 qwen-plus 返回 valid=false（403 额度不足，latency 653ms）；catalog `valid=false`、`/llm/models` 0 条；会话 CRUD 与 `/chat/conversations` 合并通过（messageCount=0 的新会话可见、docIds/compress 更新生效）；未校验模型 `/chat/message` 返回 40000；压缩测试 8 条历史 + 超阈值 → 摘要失败 → 保留最近 6 条并完成压缩重写。受额度限制，摘要成功路径未回归。

## 9. 单模型校验 / 多模态校验 / 模型类型（2026-11-13）

| 任务ID | 负责Agent | 任务内容 | 状态 | 输出文件 | 依赖/前置 |
|---|---|---|---|---|---|
| MTV-01 | MainAgent | 迁移 018：`llm_model.model_type` + `user_llm_model_verify` | 已完成（`OK executed=7`） | `VeythCog-C/docs/sql/018_model_type_and_verify.sql` | 用户三点反馈 |
| MTV-02 | MainAgent | 校验与绑定解耦：单模型校验接口、草稿 AK、Key 指纹门控 | 已完成 | `vc-llm/{service/LlmBindingVerifier,router/LlmModelRouter,entity/UserLlmModelVerify,repository/UserLlmModelVerifyRepository}`、`vc-app/web/{LlmModelController,VerifyRequest}` | MTV-01 |
| MTV-03 | MainAgent | 模型类型枚举 + 多模态探测 URL + 同步保存类型 + 目录/绑定 DTO | 已完成 | `vc-llm/{model/ModelType,service/LlmCatalogAdminService,dto,CatalogModelItem,LlmModelItem,AdminModelItem}`、`vc-app/web/{AdminLlmModelController,AdminModelSaveRequest}` | MTV-01 |
| MTV-04 | MainAgent | 前端：逐行单模型校验 + 类型图标 + 目录类型列/表单 + 对话下拉图标 | 已完成（`npm run build` EXIT=0） | `VeythCog-V/src/{components/ModelTypeTag.tsx,pages/Settings/Providers.tsx,pages/Admin/Models.tsx,pages/Chat/index.tsx,types/index.ts,api/llm.ts,api/adminModels.ts}` | MTV-02/03 |
| MTV-05 | MainAgent | 编译、迁移、8125 接口验证（验证后停服） | 已完成 | `vc-app/target/run-8125-type.log` | MTV-02~04 |
| MTV-06 | MainAgent | 文档同步 | 已完成 | `PROJECT_MEMORY.md`、`.ai-context/change-log.md`、本表 | MTV-05 |

> 验证记录（2026-11-13）：`mvn -o -q -pl vc-chat,vc-llm,vc-app -am -DskipTests compile` EXIT=0；`npm run build` EXIT=0。未绑定模型 `qwen-plus` + 草稿假 AK → `valid=false`（401 翻译），证明校验不依赖绑定；不传 AK 且无绑定 → 走系统兜底并返回 403 额度提示；新建 `vision` 模型后校验走原生多模态 URL，假 AK 返回 401；目录/管理接口 `modelType` 贯通；已绑定并校验的 `qwen3.8-flash` 对话返回「模型未通过连通校验，请先在模型配置页校验」（40000）。测试模型与校验记录已清理。

## 10. 百炼地域 / 业务空间（2026-11-13）

| 任务ID | 负责Agent | 任务内容 | 状态 | 输出文件 | 依赖/前置 |
|---|---|---|---|---|---|
| WS-01 | MainAgent | 迁移 019：`user_llm_binding.workspace_id/region` + 索引 | 已完成（`OK executed=5`） | `VeythCog-C/docs/sql/019_llm_workspace_region.sql` | 用户提供华北2业务空间 |
| WS-02 | MainAgent | 地址拼装 + 生效端点解析 + 复合指纹 | 已完成 | `vc-llm/{config/DashScopeEndpoint,service/LlmEndpointService,config/LlmVendorProps,entity/UserLlmBinding}` | WS-01 |
| WS-03 | MainAgent | 校验 / 路由 / 批量保存 / 同步接入 workspace | 已完成 | `vc-llm/{service/LlmBindingVerifier,router/LlmModelRouter,service/LlmModelService,service/LlmCatalogAdminService,dto/CatalogVendorItem}`、`vc-app/web/{VerifyRequest,BatchBindRequest,LlmModelController}` | WS-02 |
| WS-04 | MainAgent | 前端业务空间/地域输入框、生效地址展示、API 参数 | 已完成（`npm run build` EXIT=0） | `VeythCog-V/src/{pages/Settings/Providers.tsx,types/index.ts,api/llm.ts}` | WS-03 |
| WS-05 | MainAgent | 编译、迁移、8125 接口验证（验证后停服） | 已完成 | `vc-app/target/run-8125-ws.log` | WS-01~04 |
| WS-06 | MainAgent | 文档同步 | 已完成 | `PROJECT_MEMORY.md`、`.ai-context/change-log.md`、本表 | WS-05 |

> 验证记录（2026-11-13）：`qwen3-vl-plus` 在 `llm-j09pwqdqv4no16ww.cn-beijing` 与标准域名双通（valid=true，约 1s）；`batchBind` 保存 workspace 后 catalog 生效地址正确，`qwen-max` 真实对话返回「你好」；不传 workspace 的批量保存保留旧值；非法 workspace 返回 40000；空间 `/api/v1/models` 可读 373 条。测试数据已清理，8125 已停止。视觉模型走原生文本生成路径返回 `url error` 的缺口已于 10.1 修复。

## 10.1 百炼兼容接口修复（2026-11-13）

| 任务ID | 负责Agent | 任务内容 | 状态 | 输出文件 | 依赖/前置 |
|---|---|---|---|---|---|
| COMPAT-01 | MainAgent | 定位 `qwen3.8-27b` 原生 `text-generation` 400 `url error`，对比标准/业务空间兼容接口 | 已完成 | 实测：兼容接口双通 200「你好」 | WS-01 |
| COMPAT-02 | MainAgent | `DashScopeVendorFactory` 改 `OpenAiChatModel` + `/compatible-mode/v1`，显式 `completionsPath=/chat/completions` | 已完成（`mvn compile` EXIT=0） | `vc-llm/{factory/DashScopeVendorFactory,config/DashScopeEndpoint}` | COMPAT-01 |
| COMPAT-03 | MainAgent | 多模态校验改同源兼容 `/chat/completions`（图片输入），生成类超时 20s→60s | 已完成 | `vc-llm/service/LlmBindingVerifier` | COMPAT-02 |
| COMPAT-04 | MainAgent | 校验通过后回写草稿 workspace/region 到该供应商绑定行，保证校验/对话同端点 | 已完成 | `vc-llm/service/LlmBindingVerifier#persistDraftEndpoint` | COMPAT-02 |
| COMPAT-05 | MainAgent | 8125 端到端验收：业务空间校验 + 真实对话 + 指纹/绑定落库 | 已完成（校验约 4s，对话 `code=0`「你好」1.7s） | 绑定表 `qwen3.8-27b → llm-j09pwqdqv4no16ww / cn-beijing` | COMPAT-01~04 |
| COMPAT-06 | MainAgent | 文档同步 | 已完成 | `PROJECT_MEMORY.md`、`.ai-context/change-log.md`、本表 | COMPAT-05 |
| COMPAT-07 | MainAgent | 同类隐患：`OpenAiCompatVendorFactory`（DeepSeek）baseUrl 带 `/v1` 时避免 `/v1/v1` | 已完成（编译 EXIT=0） | `vc-llm/factory/OpenAiCompatVendorFactory` | COMPAT-02 |

> 说明：Spring AI `OpenAiApi` 默认 completionsPath 为 `/v1/chat/completions`，baseUrl 已含 `/v1` 时必须显式覆盖，否则会 404。`qwen3.8-27b` 类型仍为 `vision`（TG+VU 并存），文本对话已走兼容接口可用。

## 11. 模型目录全模态 + 同步覆盖已有数据（2026-11-13）

| 任务ID | 负责Agent | 任务内容 | 状态 | 输出文件 | 依赖/前置 |
|---|---|---|---|---|---|
| MOD-01 | MainAgent | 迁移 020：`llm_model.modalities` + 按主类型回填 | 已完成（`OK executed=3`，373 行无空值） | `VeythCog-C/docs/sql/020_llm_model_modalities.sql` | 用户多模态反馈 |
| MOD-02 | MainAgent | 能力全量映射 + 主类型决策 + 逗号串编解码 | 已完成 | `vc-llm/model/{ModelType,ModelModalities}.java` | MOD-01 |
| MOD-03 | MainAgent | 同步更新已有模型（类型/模态/占位名称），保留运营配置；结果增 updated | 已完成 | `vc-llm/service/LlmCatalogAdminService.java`、`dto/ModelSyncResult.java`、`vc-app/web/{AdminLlmModelController,AdminModelSaveRequest}.java` | MOD-02 |
| MOD-04 | MainAgent | 前端多模态标签/图标、目录筛选、管理表单多选、配置页/对话下拉 | 已完成（`npm run build` EXIT=0） | `VeythCog-V/src/{components/ModelTypeTag.tsx,pages/Admin/Models.tsx,pages/Settings/Providers.tsx,pages/Chat/index.tsx,types/index.ts,api/adminModels.ts}` | MOD-03 |
| MOD-05 | MainAgent | 编译、8125 同步/接口/对话验证（验证后停服） | 已完成 | `vc-app/target/run-8125-modalities.log` | MOD-01~04 |
| MOD-06 | MainAgent | 文档同步 | 已完成 | `PROJECT_MEMORY.md`、`.ai-context/change-log.md`、本表 | MOD-05 |

> 验证记录（2026-11-13）：`mvn -o -q -pl vc-llm,vc-app -am -DskipTests compile` EXIT=0；`npm run build` EXIT=0。百炼同步 `total=373 / updated=84 / unchanged=289`，`qwen3.8-27b → reasoning + text,reasoning,vision`；二次同步 `updated=0 / unchanged=373`。用户模型接口与目录接口均下发 `modalities`；`qwen3.8-27b` 对话 `code=0` 约 1.54s；临时模型新增/编辑多模态验证后已删除，测试会话已删除，8125 已停止。

## 12. 导航体验 P3（2026-11-14）

| 任务ID | 负责Agent | 任务内容 | 状态 | 输出文件 | 依赖/前置 |
|---|---|---|---|---|---|
| NAV3-01 | MainAgent | 标题体系：`useDocumentTitle` + `pageTitle` 映射，接入 MainLayout/ToolsLayout/Home/Login | 已完成 | `VeythCog-V/src/{hooks/useDocumentTitle.ts,utils/pageTitle.ts}`、`layouts/MainLayout.tsx`、`pages/tools/ToolsLayout.tsx` | 用户确认「先改导航」 |
| NAV3-02 | MainAgent | 全局命令面板：Ctrl/Cmd+K、分组/过滤/键盘操作/a11y、`/` 聚焦首页搜索、工具懒加载、admin 可见性 | 已完成 | `VeythCog-V/src/components/CommandPalette.tsx`、`App.tsx`、`pages/Home/SearchBar.tsx` | NAV3-01 |
| NAV3-03 | MainAgent | 工具集：返回 `/home`、按工具名设标题、多标签 `useToolTabsStore` 持久化 | 已完成 | `VeythCog-V/src/pages/tools/ToolsLayout.tsx`、`stores/toolTabsStore`（复用） | NAV3-01 |
| NAV3-04 | MainAgent | 设置/系统管理二级导航「返回首页」；rail 搜索按钮；`RequireAuth` 保留 query/hash、`RequireAdmin` 回落 `/home` | 已完成 | `components/SectionNav.tsx`、`layouts/MainLayout.tsx`、`App.tsx`、`pages/{Settings,Admin}/index.tsx` | NAV3-02 |
| NAV3-05 | MainAgent | 样式与构建：`.vc-palette*`/`.vc-kbd`/`.vc-subnav__back`（仅令牌）；`tsc --noEmit`、`npm run build` | 已完成（EXIT=0；build 约 7s） | `VeythCog-V/src/styles/page.css`、`VeythCog-V/dist` | NAV3-02~04 |
| NAV3-06 | MainAgent | 运行时验收（4173 preview）：标题、`/` 聚焦、面板过滤/回车跳转、标签持久化、返回首页、键盘导航 | 已完成（书签空、Modal 目视不收为环境限制） | `openspec/changes/p3-nav-experience/tasks.md`、本表 | NAV3-05 |
| NAV3-07 | MainAgent | 文档同步 | 已完成 | `openspec/changes/p3-nav-experience/*`、`.ai-context/change-log.md`、本表 | NAV3-06 |

> 验证记录（2026-11-14）：`npx tsc --noEmit` EXIT=0；`npm run build` EXIT=0。preview 构建 API base 指向 `https://api.veythcog.top`，浏览器 `ERR_FAILED`，故书签分组为空属预期；自动化浏览器不触发 `transitionend`，antd Modal 停在 `ant-zoom-leave` 无法目视收起（既有弹窗同样复现），判定环境限制。推迟项：对话页输入法回车/滚动跟随、Admin 四页 loading/error、≤520px、表格横滚、表单校验统一、会话搜索。

## 13. 表单体验 P3（2026-11-14）

| 任务ID | 负责Agent | 任务内容 | 状态 | 输出文件 | 依赖/前置 |
|---|---|---|---|---|---|
| FRM-01 | MainAgent | `client.ts`：超时/断网错误转中文 `ApiError`（408 / 0） | 已完成 | `VeythCog-V/src/api/client.ts` | 用户确认「继续改表单」 |
| FRM-02 | MainAgent | `BookmarkModal`：网址/名称迁 `Form` + rules，图标校验内联 `iconError` | 已完成 | `VeythCog-V/src/pages/Home/BookmarkModal.tsx` | FRM-01 |
| FRM-03 | MainAgent | `Login`：登录/注册迁 `Form` + name + rules，去掉 warning toast | 已完成 | `VeythCog-V/src/pages/Login/index.tsx` | FRM-01 |
| FRM-04 | MainAgent | `page.css`：`.vc-field-error` 与表单错误字号 | 已完成 | `VeythCog-V/src/styles/page.css` | FRM-02 |
| FRM-05 | MainAgent | 构建/类型检查 + 4173 preview 运行时内联错误抽查 | 已完成（`tsc` 0、build 7.47s） | `openspec/changes/p3-forms/tasks.md`、本表 | FRM-02~04 |
| FRM-06 | MainAgent | 文档同步 | 已完成 | `openspec/changes/p3-forms/*`、`.ai-context/change-log.md`、本表 | FRM-05 |

> 验证记录（2026-11-14）：登录空提交「请输入用户名/请输入密码」、注册 `123`「密码至少 6 位」、确认不一致「两次输入的密码不一致」，toast 计数均为 0；书签空提交「请填写网址/请填写名称」、`abc` 触发前缀错误、图标文字清空「请填写图标文字」（`rgb(239,68,68)` / 12px）；「获取图标」在 API 不可达时提示「网络连接失败，请检查网络或服务地址」。preview 构建 API base 为 `https://api.veythcog.top`，`/api/*` 不可达属预期；30s 超时未实机触发。推迟项：Admin 四页 loading/error、≤520px、表格横滚、会话搜索、统一错误摘要。
## 14. 对话输入框布局 P3（2026-11-14）

| 任务ID | 负责Agent | 任务内容 | 状态 | 输出文件 | 依赖/前置 |
|---|---|---|---|---|---|
| CMP-01 | MainAgent | 工具行分组（左工具 / 右参数 + 分隔线），类名统一 `.vc-composer__resize` / `__grip` | 已完成 | `VeythCog-V/src/pages/Chat/index.tsx` | 用户反馈截图 |
| CMP-02 | MainAgent | 补齐拖拽把手样式（静置可见、hover/聚焦/拖拽加粗主色、ns-resize、焦点环） | 已完成 | `VeythCog-V/src/styles/page.css` | CMP-01 |
| CMP-03 | MainAgent | 知识库引用行间距/省略、模型下拉与已绑定模型间距收敛 | 已完成 | `VeythCog-V/src/styles/page.css` | CMP-01 |
| CMP-04 | MainAgent | 构建/类型检查 + 4173 preview 实测把手、拖拽、键盘、分组 | 已完成（`tsc` 0；build 12.5s） | `openspec/changes/p3-composer-layout/tasks.md`、本表 | CMP-02~03 |
| CMP-05 | MainAgent | 文档同步 + 行尾归一（page.css 恢复 LF） | 已完成 | `openspec/changes/p3-composer-layout/*`、`.ai-context/change-log.md`、本表 | CMP-04 |

> 验证记录（2026-11-14）：抓手 `44×4`、圆角 `9999px`、`cursor:ns-resize`、`touch-action:none`；拖拽 140px 使 textarea `44→110`、grip `is-active`；合成 `ArrowUp` 使 `44→68`；左组 x≈418–542、分隔线 x≈550、右组 x≈2408–2488，右组靠右成立。preview API base 指向 `https://api.veythcog.top`，验收用 `page.route` 桩接会话/模型接口。推迟项：≤520px 移动端换行与触屏拖拽、输入法回车、流式滚动跟随、Admin 四页状态、表格横滚。
