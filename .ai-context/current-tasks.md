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


