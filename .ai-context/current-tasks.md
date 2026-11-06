# 当前任务分配表（current-tasks.md）

> 用途：记录「谁（Agent）、做什么、状态、输出文件、依赖」。每次任务启动/完成/受阻时更新本表，并在 `change-log.md` 追加变更记录。
> 状态枚举：`待认领` / `进行中` / `已完成` / `受阻` / `已取消`。

## 1. 活跃任务（知识库模块 P0）

| 任务ID | 负责Agent | 任务内容 | 状态 | 输出文件 | 依赖/前置 |
|---|---|---|---|---|---|
| KB-01 | 待分配 | 后端：`knowledge_doc`/`knowledge_embedding` 实体 + Repository（JPA） | 待认领 | `vc-knowledge/src/main/java/com/vc/knowledge/entity/*`、`repository/*` | 执行 `openspec/sql/knowledge-init.sql` |
| KB-02 | 待分配 | 后端：文档 CRUD + 导入导出 + 关键词检索 Service/Controller | 待认领 | `vc-knowledge/.../service/*`、`vc-app/.../web/KnowledgeController.java` | KB-01 |
| KB-03 | 待分配 | 后端：向量化/取消向量化/RAG 召回（EmbeddingModel + pgvector `<=>`） | 待认领 | `vc-knowledge/.../service/VectorizeService.java` 等 | KB-01；Embedding 模型/维度已核查 |
| KB-04 | 待分配 | 后端：访客只读演示库（SecurityConfig 放行 `GET /api/knowledge/demo/**` + 写接口 403 校验） | 待认领 | `vc-app/.../config/SecurityConfig.java` | KB-02 |
| KB-05 | 待分配 | 前端：知识库总览/编辑器/导入导出页切真实接口 | 待认领 | `VeythCog-V/src/pages/Knowledge/*`、`src/api/knowledge.ts`、`src/types/index.ts` | 契约 `openspec/api-spec.md` |
| KB-06 | 待分配 | 前端：BlockNote 块编辑器接入（斜杠菜单/拖拽/md 序列化） | 待认领 | `VeythCog-V/src/pages/Knowledge/editor/*` | 新增 `@blocknote/*` 依赖 |
| KB-07 | 待分配 | 前端：AI 对话侧知识库选择抽屉 + RAG 引用卡片 | 待认领 | `VeythCog-V/src/pages/Chat/*` | KB-03、KB-05 |

## 2. 已完成任务（文档规范化，本次会话）

| 任务ID | 负责Agent | 任务内容 | 状态 | 输出文件 | 依赖/前置 |
|---|---|---|---|---|---|
| DOC-01 | JoyCode | 扫描代码库并评审知识库 PRD 可行性 | 已完成 | 对话结论 | — |
| DOC-02 | JoyCode | 优化 PRD（v0.1→v0.2，修正向量维度/中文检索/软删除等） | 已完成 | `openspec/knowledge-prd.md` | DOC-01 |
| DOC-03 | JoyCode | 输出 API 契约 | 已完成 | `openspec/api-spec.md` | DOC-02 |
| DOC-04 | JoyCode | 输出建表 SQL（含 pgvector 扩展/HNSW/中文索引） | 已完成 | `openspec/sql/knowledge-init.sql` | DOC-02 |
| DOC-05 | JoyCode | 建立 `.ai-context/` 协作文档（global-rule/current-tasks/change-log） | 已完成 | `.ai-context/*` | DOC-01~04 |

## 3. 待办/阻塞

- **环境事实（已确认，可启动 KB-03）**：① Embedding 维度 `1024`（qwen3.7-text-embedding-flash）；② 目标库已迁到个人服务器 docker 容器，pgvector 扩展已启用；③ datasource 为个人服务器 docker（非 Supabase 云端）。详见 `change-log.md`。
- **依赖缺口**：后端 `vc-knowledge/pom.xml` 缺 `spring-ai-alibaba-starter-dashscope`/`postgresql`；前端 `package.json` 缺 `@blocknote/*`。
