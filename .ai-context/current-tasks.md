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
