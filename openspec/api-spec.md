# VeythCog 知识库模块 API 契约（P0）

> 文档路径：`openspec/api-spec.md`
> 关联 PRD：`openspec/knowledge-prd.md`
> 版本：v0.4-P0
> 状态：与代码同步（2026-11-09）。已移除全部「私有库 / 演示库」契约（`libType`、访客只读、demo 403）

## 0. 通用约定

| 项 | 约定 |
|---|---|
| 基础前缀 | `/api/knowledge` |
| 鉴权 | `Authorization: Bearer <JWT>`；全部 `/api/knowledge/**` 需登录（无匿名放行分支，见 §1） |
| 响应包装 | `{ code, data, message }`（注意字段名是 **message**，非 msg） |
| 成功码 | `code = 0`，`message = "ok"` |
| 分页参数 | `current`(默认1) / `pageSize`(默认10) / `sortField` / `sortOrder`(`ascend`/`descend`，默认 `descend`) |
| 时间字段 | 后端返回 epoch 毫秒（`number`），前端 `formatRelativeTime` 渲染 |

### 错误码（复用 `vc-common` 的 `ErrorCode`）

| code | 枚举 | 含义 |
|---|---|---|
| 0 | SUCCESS | 成功 |
| 40000 | PARAMS_ERROR | 请求参数错误 |
| 40100 | NOT_LOGIN_ERROR | 未登录 |
| 40101 | NO_AUTH_ERROR | 无权限 |
| 40300 | FORBIDDEN_ERROR | 禁止访问（保留：后续中间件赋权失败时使用） |
| 40400 | NOT_FOUND_ERROR | 请求数据不存在 |
| 50000 | SYSTEM_ERROR | 系统内部异常 |
| 50001 | OPERATION_ERROR | 操作失败（如向量化失败） |

> 后端统一用 `ThrowUtils.throwIf(condition, errorCode, message)` 抛 `BusinessException`，由 `GlobalExceptionHandler` 包装成 `BaseResponse`，不手写 `try/catch` 返回结构。

## 1. 权限矩阵

| 接口 | 未登录 | 登录用户 | 说明 |
|---|---|---|---|
| 全部 `/api/knowledge/**`（list/doc/export/rag） | ❌ 401 | ✅ | 无匿名只读分支 |
| 写操作（create/update/delete/vectorize/import） | ❌ 401 | ✅ | — |

> **落地方式**：`SecurityConfig` 保持 `anyRequest().authenticated()`，不设 demo 放行路径，校验不再按 `libType` 分支。
>
> **用户级隔离（暂不做）**：本阶段文档为全账号共享，**不校验 `owner_id`**；用户级赋权由统一中间件后续承担，多账号对外开放前必须先就位。因此本文件所有接口的鉴权结论统一为"登录即可"。

## 2. 数据对象（DTO）

### 2.1 DocListItem（列表项）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | number | 文档 id |
| title | string | 标题 |
| summary | string | 摘要（截取自 markdown_text） |
| tags | string[] | 标签 |
| isVectorized | boolean | 是否已向量化 |
| updatedAt | number | 更新时间（epoch ms） |

### 2.2 DocDetail（详情）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | number | 文档 id |
| title | string | 标题 |
| summary | string | 摘要 |
| tags | string[] | 标签 |
| blockData | Block[] | 块结构数组（权威源） |
| markdownText | string | 派生 Markdown 缓存 |
| isVectorized | boolean | 是否已向量化 |
| createdAt | number | 创建时间（epoch ms） |
| updatedAt | number | 更新时间（epoch ms） |

> `Block` 结构：`{ id, type, props, content }`，每个块携带独立 `id`（预留块级元数据/向量化）。

### 2.3 RetrieveChunk（RAG 召回片段）
| 字段 | 类型 | 说明 |
|---|---|---|
| chunkText | string | 分片原文 |
| docId | number | 来源文档 id |
| title | string | 来源文档标题 |
| chunkIndex | number | 文档内分片序号（从 0 起），用于引用溯源 |
| score | number | L2 距离（越小越相似） |

## 3. 接口清单

### 3.1 文档基础 CRUD

**1. 文档列表** `GET /api/knowledge/list`
- query：`keyword`、`tag`、`sortField`、`sortOrder`、`current`、`pageSize`
- 返回：`data = { records: DocListItem[], total: number, current, pageSize }`
- 说明：关键词走 PG `to_tsvector('simple', ...)` 文本检索；`keyword` 为空时按排序全量分页

**2. 文档详情** `GET /api/knowledge/doc/{docId}`
- 返回：`data = DocDetail`
- 校验：需登录；`deleted=false`

**3. 新建文档** `POST /api/knowledge/doc`
- body：`{ title, tags, blockData, markdownText, summary }`
- 返回：`data = { docId }`
- 校验：`title` 非空；`blockData` 为权威源，后端可据其兜底生成 `markdownText`

**4. 更新文档** `PUT /api/knowledge/doc/{docId}`
- body：同新建；更新 `updated_at`
- 校验：更新后 `is_vectorized` 置 false（内容已变更，向量过期），由前端提示重新向量化；检索端已过滤 `is_vectorized=true`，过期向量不会再被召回

**5. 删除文档** `DELETE /api/knowledge/doc/{docId}`
- 语义：软删除 `deleted=true` + **显式清理** `knowledge_embedding`（事务内）

### 3.2 导入导出

**6. 导入 Markdown** `POST /api/knowledge/import/md`
- form-data：`file`(仅 `.md`，≤500KB) + `title` + `tags`
- 返回：`data = { docId }`
- 说明：后端解析 md → block 数组写入 `block_data`，回填 `markdown_text`；非法后缀/超大小 40000

**7. 导出 Markdown** `GET /api/knowledge/doc/{docId}/export/md`
- 返回：`application/octet-stream` 下载流，内容为 `markdown_text`

### 3.3 向量相关

- 流程：读 `markdown_text` → 自定义 `RecursiveCharacterTextSplitter` 切片（`\n\n > \n > 句号 > 逗号 > 空格`，优先保留代码块）→ `EmbeddingProvider` 编码（qwen3.7-text-embedding-flash，维度 1024）→ **事务内先删该 docId 旧向量再 saveBatch 插入**（幂等，以 `doc_id` 为幂等键，写入 `embedding_model` 标识）→ 置 `is_vectorized=true`
- 元数据自动填充（v0.5）：向量化同时调用**辅助模型**（`llm.aux-model`，与用户对话模型解耦）生成摘要/标签；策略为**仅空值填充**——`summary` 为空或 `tags` 为空时才生成并补齐，已有内容不覆盖；摘要/标签都完整时直接跳过模型调用。生成失败不阻断向量化（降级返回 `summary=null, tags=[]`，日志 `WARN`）。
- 返回：`data = { chunkCount, summary?, tags? }`（`summary/tags` 为本次实际落库的值，未生成时为 `null` / 空数组）
- 失败：embedding 超时/超限不阻塞文档保存，返回 `OPERATION_ERROR` + 提示

**8.1 重新生成摘要与标签** `POST /api/knowledge/doc/{docId}/metadata/regenerate`
- 返回：`data = { summary, tags }`
- 说明：**显式覆盖**已有摘要与标签（前端需二次确认），失败直接报错不静默降级；只改元数据，不动正文与向量化状态

**9. 取消向量化** `POST /api/knowledge/doc/{docId}/unvectorize`
- 流程：删除该文档全部 embedding，置 `is_vectorized=false`

**10. RAG 召回** `POST /api/knowledge/rag/retrieve`
- body：`{ docIds: number[], query: string, topN: number }`
- 返回：`data = RetrieveChunk[]`
- 说明：查询向量化 → **限定本次勾选的 `docIds` 集合**做 L2 距离检索 `embedding <-> $query`，加 `distance` 阈值过滤（实测阈值 1.2；**无命中时回退 topN，不返回空**）+ `embedding_model` 标识校验 + 关联文档 `deleted=false` 与 `is_vectorized=true` 过滤，禁止全库向量搜索；返回片段/文档 ID/标题/chunk 索引/距离，用于引用溯源
- rerank（v0.5）：对话链路在召回阶段先取 `knowledge.retrieve.rerank.candidates`（默认 10）条，再由辅助模型按与问题的相关度重排，截取 `topN` 注入 prompt；解析失败/编号缺失自动回退向量顺序，不影响回答；本接口本身不做 rerank
- 备注：对话侧已改为**后端内部调用**（见 §3.5），前端不再直接调用本接口；保留该接口用于调试与独立检索场景

### 3.4 扩展预留（P0 不实现，仅占位）
- `POST /api/knowledge/batch/vectorize` / `batch/move` / `batch/tag` / `batch/delete`

### 3.5 对话侧 RAG 契约（后端统一检索，v0.4）

**`POST /api/chat/stream`**（SSE，`text/event-stream`）
- body：`{ message, vendor, modelCode, conversationId?, docIds?: number[] }`
- `docIds` 非空 → 后端 `RagChatOrchestrator` 检索（topN=5）、拼带编号引用的上下文、再调模型；为空或召回失败 → 按普通对话处理（不报错、不中断）
- 事件顺序：
  1. `event: references` / `data: RetrieveChunk[]` —— 本次召回结果（JSON 数组，无命中为 `[]`）
  2. `data: <token>` —— 逐 token 正文
  3. `data: [DONE]` —— 结束
  4. `event: error` / `data: <message>` —— 模型调用失败
- 引用与上下文同源：`references` 就是喂给模型的那份片段，前端只展示，不再自行检索

**`POST /api/chat/message`**（同步）
- body 同上；返回 `BaseResponse<string>`（仅正文）

**会话历史（v0.4 新增，数据源 = 对话记忆表 `chat_message`）**
- `GET /api/chat/conversations` → `BaseResponse<ChatConversationVO[]>`
  - 字段：`id`（已剥离 `userId:` 前缀）、`title`（首条用户消息）、`lastMessage`、`messageCount`、`createdAt`、`updatedAt`；按 `updatedAt` 倒序
  - 后端无独立会话表：会话即同一 `conversation_id` 的消息集合；记忆主键为 `userId:conversationId`，查询按该前缀收敛
- `GET /api/chat/conversations/{conversationId}/messages` → `BaseResponse<ChatMessageVO[]>`
  - 字段：`id`、`role`（user/assistant，system 不下发）、`content`、`createdAt`；按 `seq` 升序
  - RAG 场景落库的用户消息含「资料上下文 + 用户问题」，接口返回时剥离上下文，只回显用户原始问题
- `DELETE /api/chat/conversations/{conversationId}` → `BaseResponse<boolean>`（物理删除该会话记忆行）
- 已知限制：记忆为 `MessageWindowChatMemory`（窗口 20 条）全量覆盖写，超长会话的早期消息会被窗口裁掉，接口只能回显库中现存部分

## 4. 幂等与防御

- 向量化以 `doc_id` 为幂等键，先删后插，重复调用结果一致。
- 空值归一化：`tags` 缺省 `[]`、`summary` 缺省 `''`、`blockData` 缺省 `[]`。
- 所有接口后端校验登录态与参数合法性，不信任前端隐藏逻辑；用户级归属校验由统一中间件承担（本阶段不做）。

## 5. 监控 key（预留）

| key | 含义 |
|---|---|
| `knowledge.vectorize.duration` | 单文档向量化耗时 |
| `knowledge.embedding.fail` | embedding 调用失败次数 |
| `knowledge.rag.recall_count` | RAG 单次召回片段数 |
