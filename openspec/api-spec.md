# VeythCog 知识库模块 API 契约（P0）

> 文档路径：`openspec/api-spec.md`
> 关联 PRD：`openspec/knowledge-prd.md`
> 版本：v0.2-P0
> 状态：契约先行，前端先 mock，后端按本契约实现后切换

## 0. 通用约定

| 项 | 约定 |
|---|---|
| 基础前缀 | `/api/knowledge` |
| 鉴权 | `Authorization: Bearer <JWT>`；未登录仅可访问演示库只读接口（见 §1 权限矩阵） |
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
| 40300 | FORBIDDEN_ERROR | 禁止访问（演示库写操作/私有库越权） |
| 40400 | NOT_FOUND_ERROR | 请求数据不存在 |
| 50000 | SYSTEM_ERROR | 系统内部异常 |
| 50001 | OPERATION_ERROR | 操作失败（如向量化失败） |

> 后端统一用 `ThrowUtils.throwIf(condition, errorCode, message)` 抛 `BusinessException`，由 `GlobalExceptionHandler` 包装成 `BaseResponse`，不手写 `try/catch` 返回结构。

## 1. 权限矩阵

| 接口 | 访客（未登录） | 登录用户 | 说明 |
|---|---|---|---|
| 私有库 CRUD / 向量化 / 导入导出 | ❌ 401 | ✅ | 私有库仅本人 |
| 演示库只读（list/doc/export/rag） | ✅ | ✅ | 演示库文档锁定编辑 |
| 演示库写操作（create/update/delete/vectorize/import） | ❌ 401 | ❌ 403 | 后端强制拒绝，不信任前端 |

> 落地方式：`SecurityConfig` 放行 `GET /api/knowledge/demo/**`（只读），其余 `/api/knowledge/**` 需登录；写接口内再校验 `libType=demo` 一律 `FORBIDDEN_ERROR`。

## 2. 数据对象（DTO）

### 2.1 DocListItem（列表项）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | number | 文档 id |
| title | string | 标题 |
| summary | string | 摘要（截取自 markdown_text） |
| tags | string[] | 标签 |
| libType | 'private' \| 'demo' | 库类型 |
| isVectorized | boolean | 是否已向量化 |
| updatedAt | number | 更新时间（epoch ms） |

### 2.2 DocDetail（详情）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | number | 文档 id |
| libType | 'private' \| 'demo' | 库类型 |
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
- query：`libType`(必填)、`keyword`、`tags`、`sortField`、`sortOrder`、`current`、`pageSize`
- 返回：`data = { records: DocListItem[], total: number, current, pageSize }`
- 说明：关键词走 PG `to_tsvector('simple', ...)` 文本检索；`keyword` 为空时按排序全量分页

**2. 文档详情** `GET /api/knowledge/doc/{docId}`
- 返回：`data = DocDetail`
- 校验：私有库需登录且归属本人；演示库访客/登录用户均可读

**3. 新建文档** `POST /api/knowledge/doc`
- body：`{ libType, title, tags, blockData, markdownText, summary }`
- 返回：`data = { docId }`
- 校验：`libType=demo` 一律 403；`title` 非空；`blockData` 为权威源，后端可据其兜底生成 `markdownText`

**4. 更新文档** `PUT /api/knowledge/doc/{docId}`
- body：同新建；更新 `updated_at`
- 校验：演示库文档禁止修改（403）；更新后 `is_vectorized` 语义上置 false（内容已变更，向量过期），由前端提示重新向量化

**5. 删除文档** `DELETE /api/knowledge/doc/{docId}`
- 语义：软删除 `deleted=true` + **显式清理** `knowledge_embedding`（事务内）
- 校验：演示库文档禁止删除（403）

### 3.2 导入导出

**6. 导入 Markdown** `POST /api/knowledge/import/md`
- form-data：`file`(仅 `.md`，≤500KB) + `libType` + `title` + `tags`
- 返回：`data = { docId }`
- 说明：后端解析 md → block 数组写入 `block_data`，回填 `markdown_text`；非法后缀/超大小 40000

**7. 导出 Markdown** `GET /api/knowledge/doc/{docId}/export/md`
- 返回：`application/octet-stream` 下载流，内容为 `markdown_text`

### 3.3 向量相关

- 流程：读 `markdown_text` → 自定义 `RecursiveCharacterTextSplitter` 切片（`\n\n > \n > 句号 > 逗号 > 空格`，优先保留代码块）→ `EmbeddingProvider` 编码（qwen3.7-text-embedding-flash，维度 1024）→ **事务内先删该 docId 旧向量再 saveBatch 插入**（幂等，以 `doc_id` 为幂等键，写入 `embedding_model` 标识）→ 置 `is_vectorized=true`
- 返回：`data = { chunkCount }`
- 失败：embedding 超时/超限不阻塞文档保存，返回 `OPERATION_ERROR` + 提示

**9. 取消向量化** `POST /api/knowledge/doc/{docId}/unvectorize`
- 流程：删除该文档全部 embedding，置 `is_vectorized=false`

**10. RAG 召回** `POST /api/knowledge/rag/retrieve`
- body：`{ docIds: number[], query: string, topN: number }`
- 返回：`data = RetrieveChunk[]`
- 说明：查询向量化 → **限定本次勾选的 `docIds` 集合**做 L2 距离检索 `embedding <-> $query`，加 `distance` 阈值过滤 + `embedding_model` 标识校验 + 关联文档软删除过滤，禁止全库向量搜索；**强制同库**（不跨库混合召回）；返回片段/文档 ID/标题/chunk 索引/距离，用于引用溯源

### 3.4 扩展预留（P0 不实现，仅占位）
- `POST /api/knowledge/batch/vectorize` / `batch/move` / `batch/tag` / `batch/delete`

## 4. 幂等与防御

- 向量化以 `doc_id` 为幂等键，先删后插，重复调用结果一致。
- 空值归一化：`tags` 缺省 `[]`、`summary` 缺省 `''`、`blockData` 缺省 `[]`。
- 所有写接口后端二次校验权限与 `libType`，不信任前端隐藏逻辑。

## 5. 监控 key（预留）

| key | 含义 |
|---|---|
| `knowledge.vectorize.duration` | 单文档向量化耗时 |
| `knowledge.embedding.fail` | embedding 调用失败次数 |
| `knowledge.rag.recall_count` | RAG 单次召回片段数 |
