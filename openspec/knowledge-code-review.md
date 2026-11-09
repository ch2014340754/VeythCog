# 知识库模块 · 源码完善度评审（v4 · RAG 后端化 + 概念清除已落地）

> 评审对象：`VeythCog-C`（vc-knowledge + KnowledgeController + orchestration）× `VeythCog-V`（Knowledge 页 / DocEditor / Chat RAG 抽屉）
> 评审基准：`PROJECT_MEMORY.md`（2026-11-09 版）、`docs/sql/009~011`、`openspec/knowledge-prd.md`、`openspec/api-spec.md`
> 评审方式：只读代码遍历 + 本地编译验证（未连库、未起服务）
> 首版：2026-11-09 · v2 同日复核 · v3 确认 011 已执行 + 权限决策 · **v4：按用户决策实施（RAG 引用归后端、私有库/演示库彻底清除），A3/A4 已修复**

---

## 0. 结论速览（v4）

| 维度 | 评价 | 说明 |
|---|---|---|
| 分层与骨架 | ✅ 完整 | 依赖方向正确；MP + pgvector + 三个 TypeHandler + 自定义 splitter 均已落地；新增 `RagChatOrchestrator` 由 app 层编排，chat/knowledge 仍互不依赖 |
| 可编译性 | ✅ 通过 | 后端 `mvn -DskipTests compile` 通过（JDK 21）；前端 `tsc --noEmit` 通过（v4 改动后复跑） |
| 端到端可跑通 | ✅ 成立 | `009` 已不再建 `lib_type`；旧库按新版 `011` 重跑一次即删列（`DROP COLUMN IF EXISTS`，幂等），09/10 已执行 |
| 权限 | ✅ 按决策免修 | 「私有库/演示库」已彻底清除；**本阶段不做按用户隔离**，赋权交统一中间件 |
| RAG 闭环 | ✅ 已闭环 | `ChatRequest.docIds` → 后端 `RagChatOrchestrator` 检索并**注入 prompt** → SSE 先发 `event: references` 再逐 token 下发；前端只展示引用，不再自行 retrieve |

一句话：**RAG 从"前端检索 + 卡片装饰"变成了"后端检索即上下文"；库类型概念连同列、索引、文档、代码注释一并清空。**

### v4 实施清单（2026-11-09）

| 改动 | 落点 |
|---|---|
| 新增 RAG 编排 | `vc-app/.../orchestration/RagChatOrchestrator.java`（`retrieveSafely` 降级容错 / `buildAugmentedMessage` 带 [n] 编号 / `answer` 同步入口） |
| 对话契约扩展 | `ChatRequest.docIds`；`ChatController` 同步与流式均走编排器，流式先发 `event: references`（`RetrieveChunk` JSON 数组） |
| 检索有效性 | `KnowledgeEmbeddingMapper.xml` 增加 `d.is_vectorized = true` 过滤，过期向量不再被召回 |
| 前端只消费 | `api/chat.ts` 传 `docIds` + 解析 `event: references` → `onReferences`；`pages/Chat/index.tsx` 删除本地 `retrieve()`，引用挂到 assistant 消息 |
| 概念清除（脚本） | `009` 移除 `lib_type` 列/注释/组合索引（改为 `idx_knowledge_doc_deleted`）；`011` 改为 `DROP COLUMN IF EXISTS lib_type` |
| 概念清除（代码） | `DocEditor` 去掉 `readOnly`（演示库只读唯一用途）；`Knowledge/index.tsx` 去掉 `readOnly={false}`；CSS 注释改写 |
| 概念清除（文档） | `knowledge-prd.md` v0.4、`api-spec.md` v0.4（含新增 §3.5 对话侧 RAG 契约）、`llm-binding-prd.md`、`PROJECT_MEMORY.md`、`openspec/sql/knowledge-init.sql` |

---

## 1. 上一版结论的修正（重要）

| 上版结论 | v2 判定 | 依据 |
|---|---|---|
| A1 `lib_type NOT NULL` 导致新建/导入必失败 | **已归档（列已删除）** | v4 起 `009` 不再建该列、`011` 改为 `DROP COLUMN`；问题随概念一起消失 |
| A2 demo 只读 / 私有库仅本人未实现 | **整条作废** | 记忆文档 §4/§5 + §10.1 明确：demo 概念已移除，且**本阶段不做用户隔离**，赋权交给统一中间件 |
| 引用 `openspec/sql/knowledge-init.sql` 作为建表依据 | **依据失效** | 权威脚本已迁到 `VeythCog-C/docs/sql/009~011`；`openspec/sql/` 下那份 `knowledge-init.sql` 仍是无默认值、含 demo 设计的旧版，属死文档 |
| A3 / A5 / P1·P2 其余项 | **维持（A3 已部分修复）** | A3 检索端已加 `is_vectorized` 过滤；A4 已闭环；其余代码未变 |

---

## 2. 仍然成立的阻断/高风险问题

### A3. 内容更新后旧向量残留，检索不校验有效期（v4 已部分修复）

**证据**
- `KnowledgeServiceImpl.update`：仍只 `setIsVectorized(false)`，不清 `knowledge_embedding`。
- `KnowledgeEmbeddingMapper.xml`：v4 已加 `AND d.is_vectorized = true`。

**修复结果**：改完文档后旧 chunk **不再被召回**（召回端已挡），但旧向量仍占存储，直到用户重新向量化（先删后插会覆盖）或手动 unvectorize。剩余为资源问题，不再有"引用与正文不符"的正确性风险。

**建议（P1）**：`update` 内顺手删 embedding，语义最干净；若担心成本，可在批量向量化里做清理。

### A4. RAG 召回结果没有进入 prompt（v4 已闭环）

**原证据**（v3 时）：前端 `retrieve()` 结果只挂引用卡片；`ChatRequest` 无 docIds；`orchestration` 空占位。

**v4 修复**
- `ChatRequest.docIds` → `ChatController` 调 `RagChatOrchestrator.retrieveSafely`（失败降级空引用，不阻断对话）。
- `buildAugmentedMessage`：召回片段带 `[1]《标题》/片段#n` 编号拼入 prompt，明确要求"优先依据资料、用编号标注、不足则说明"；正文上限 4000 字符。
- 流式先发 `event: references`（与喂给模型的片段同源），再逐 token；前端 `onReferences` 挂到 assistant 消息渲染。
- 前端不再调用 `/knowledge/rag/retrieve`，该接口保留作调试用。

### A5. 会话与知识库选择不持久（P1，且记忆文档描述有误）

**证据**
- `pages/Chat/index.tsx:59`：`useState<Conversation[]>([])`，**没用 `useChatStore`**。
- `api/chat.ts:14`：`let conversations = ...mockConversations` 模块级内存副本。
- `stores/chatStore.ts` 虽然 persist 且实现了 `appendDelta` 等，但**聊天页根本没接**。

**后果**：刷新即丢会话、丢 `knowledgeDocIds`。> 记忆文档 §4③ 写的是"会话元数据仍在前端本地（Zustand persist）"，与代码不符，见 §4 核对表第 4 条。

### A2'. 按用户隔离缺失 —— 已决策「不做」，转为前置依赖（不再是缺陷）

**现状**：`AuthServiceImpl.register`（64-78）对 `/auth/**` 开放，任何人都能注册成 `user`；`KnowledgeServiceImpl.requireDoc`（139-145）只按 docId 查，全链路不校验 userId。

**决策（2026-11-09，已写入 PROJECT_MEMORY §10.1）**：本阶段知识库为「登录即可访问的全账号共享数据」，单账号自用可接受；用户级赋权由统一中间件负责，本模块只消费其授权结果。

**唯一需要记住的约束**：多账号对外开放**之前**必须让中间件就位，否则所有文档互相可见、可改、可删。这条已作为前提记录下来，不必在知识库模块内补 `owner_id`。

---

## 3. 仍成立的契约/质量缺口

| # | 项 | 现状 | 影响 |
|---|---|---|---|
| B2 | 列表能力不足 | 只支持 `keyword + 单 tag + 排序`；无状态筛选（已/未向量化）、无底部统计；前端固定 `pageSize: 100` | PRD §3.1 的一半功能没做 |
| B3 | `importMd` 的 md→block 过于简陋 | `markdownToBlocks`（194-227）只认 `#/##/###`+段落，块内**无 `props`** | BlockNote 的 `parseBlockJson` 校验失败后靠降级解析 md 兜住；一旦前后端块结构演进就会错位 |
| B4 | `summary` 不自动生成 | `importMd` 会截 200 字；`create/update` 全靠前端传，前端默认空 | 列表页摘要长期为空；`summary` 字段实为摆设 |
| B6 | `markdownText` 无后端兜底 | create 直接取前端值，不据 `blockData` 生成 | 前端漏传即内容为空，检索/导出/向量化全空 |
| B7 | `openspec/knowledge-prd.md`、`api-spec.md` 未归档 | 仍以「私有库/演示库、访客只读、demo 写 403」为核心设计，并指向已失效的 `openspec/sql/knowledge-init.sql` | **最高隐性成本**：下个 Agent 会照着旧 PRD 把 demo 库再做一遍 |
| C1 | `vectorize` 长事务 | embedding 外部调用包在 `@Transactional` 内（54-93） | 占用连接、超时不回滚 |
| C2 | `dimensions` 未使用 | `KnowledgeProperties.embedding.dimensions` 定义但从不校验 | 换模型只能等 pgvector 报维度错 |
| C3 | IVFFlat 反效果风险 | `lists=100`，`probes` 默认 1；P0 数据量几百 chunk | 可能漏召回，不如顺序扫描 |
| C4 | 阈值未实测 | **已实测并修正**：真实库 7 条向量（已归一化）分片间 L2 距离 0.878~1.281，原阈值 0.8 导致召回恒为 0（表现为"答案不来自选中文档"）；现改为 1.2 + 无命中回退 topN |
| C5 | 零单测 | 仅空壳 `VcAppApplicationTests` | PRD §10 八条验收无一条自动化 |
| C6 | 前端知识库页缺项 | 无库切换（已无需）、**无状态筛选/排序/分页/底部统计/卡片视图**；保存后只有 toast，无"向量过期"常驻标记 | 见 PRD §3.1/§8.1 |
| C7 | 聊天抽屉粗糙 | 一次拉 100 条、无搜索、无分页 | 文档一多不可用 |
| C8 | 引用卡片不可跳转 | 只展示 chunkText | 溯源断在最后一步 |
| C9 | `mock/knowledge.ts` 孤儿 | 仅被 `mock/index.ts` re-export | 可清理 |

---

## 4. PROJECT_MEMORY 与代码的一致性核对（已于 2026-11-09 更正）

> 下表 5 处失真**已按代码逐条修正落盘**（见 PROJECT_MEMORY 当前版本），此处保留记录便于回溯；后续 Agent 请以修正后的记忆文档为准。

| # | 记忆文档位置 | 原说法（失真） | 代码实际 / 已更正为 |
|---|---|---|---|
| 1 | §3.2 vc-app `config/*` / `admin` 行 | "`admin` 系统管理后端未实现（占位）" | `AdminController`、`RoleController`、`AdminUserServiceImpl` 已实现，角色多对多；已改为「已实现」+ `orchestration` 仍占位 |
| 2 | §2 数据库行 | "vc-app 仍残留 MySQL 驱动未清理" | 全部 `pom.xml` 无 mysql 依赖；已改为「已清除 MySQL 依赖」 |
| 3 | §10 待办 #2 | "BlockNote 块编辑器**已由**自定义 md 编辑器 `DocEditor` 替代" | 事实相反：`DocEditor` 就是 BlockNote 封装（`@blocknote/core` / `react` / `mantine`）；已改为「`DocEditor` 基于 BlockNote 已落地」 |
| 4 | §4③ | "会话元数据仍在前端本地（Zustand **persist**）" | 聊天页用 `useState` + `api/chat.ts` 模块内存，`chatStore` 未接入；已改为「刷新即丢」 |
| 5 | §5 `knowledge_doc` 行 | "`lib_type` 列保留…代码不再读写"（未提执行顺序） | 已改为「无 `lib_type`（011 已删列）」 |

**同时已完成的脚本收口**：
- `openspec/sql/knowledge-init.sql` → 废弃声明 + 指向 `VeythCog-C/docs/sql/009~011`，不再保留重复 DDL。
- `docs/sql/009_knowledge.sql` → 移除 `lib_type` 列/注释/组合索引（v4）。
- `docs/sql/011_knowledge_remove_libtype.sql` → 改为 `DROP COLUMN IF EXISTS`（v4，旧库重跑一次即删列）。

---

## 5. 调整路线（v4 更新：批次 1 已完成）

**批次 1 · 让"知识库作答"真的成立** ✅ 2026-11-09 落地
1. ✅ `ChatRequest.docIds` + `RagChatOrchestrator`（检索 → 编号引用拼上下文 → 作答 → `references` 事件）。
2. ⏳ 引用卡片点击跳 `/knowledge`（未做，纯前端增量）。
3. ✅ 检索加 `is_vectorized` 过滤（A3 正确性部分已解决）。

**批次 2 · 数据与检索质量**（未开始）
4. `update` 时清空旧向量（当前仅置 flag + 召回端过滤，旧向量残留占空间）。
5. `markdownText` 后端兜底 + `summary` 自动回填；`importMd` 补 `props`。
6. `vectorize` 挪出长事务；`dimensions` 前置校验。
7. 阈值/IVFFlat 实测调参。

**批次 3 · 文档收口 + 中间件前置**
8. 用户级赋权由统一中间件承担（模块外，见记忆 §10.1）。
9. ✅ 已归档 PRD / api-spec 的 demo 章节与旧权限矩阵（v0.4），并新增 §3.5 对话侧 RAG 契约。
10. 单测：splitter / 幂等 / 软删除级联。

---

## 6. 待确认（v4）

1. ✅ 服务器库已跑 011（旧版）；**新版 011（DROP COLUMN）需重跑一次**才会真正删列 —— 待你在服务器执行。
2. ✅ RAG 引用归属：已按决策落到后端（`RagChatOrchestrator` + `event: references`）。
3. 待你决定：引用卡片是否做点击跳转到 `/knowledge/doc/{docId}`（批次 1 剩余第 2 项）。

---

## 附：本次检查过的文件

后端：`KnowledgeController`、`KnowledgeServiceImpl`、`VectorizeServiceImpl`、`KnowledgeEmbeddingServiceImpl`、`KnowledgeDoc/KnowledgeEmbedding`、`DocSaveRequest/DocDetail/DocListItem/RetrieveRequest`、两个 Mapper + XML、三个 TypeHandler、`RecursiveCharacterTextSplitter`、`DashScopeEmbeddingProvider`、`KnowledgeProperties`、`MybatisPlusConfig`、`SecurityConfig`、`JwtAuthFilter`、`AuthServiceImpl`、`ChatController/ChatRequest`、`application.yml/local`、两级 pom、`docs/sql/009/010/011`、`openspec/sql/knowledge-init.sql`。
前端：`api/knowledge.ts`、`api/client.ts`、`api/chat.ts`、`pages/Knowledge/index.tsx`、`pages/Knowledge/DocEditor.tsx`、`pages/Chat/index.tsx`（RAG 段）、`types/index.ts`、`stores/knowledgeStore.ts`、`stores/chatStore.ts`、`package.json`、`mock/knowledge.ts`。
文档：`PROJECT_MEMORY.md`（git diff 逐行比对）、`openspec/knowledge-prd.md`、`openspec/api-spec.md`。
