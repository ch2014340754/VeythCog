# VeythCog 知识库模块 PRD（优化版）

> 文档路径：`openspec/knowledge-prd.md`
> 需求名：知识库模块（路线A，轻量 RAG 实验库）
> 技术栈：React 18 + TS + Vite + AntD 5 + Zustand + BlockNote / Spring Boot 3.5 + Java 21 + Spring AI 1.1.2 + PostgreSQL 16 + pgvector
> 模块：知识库（暂不接入飞书同步）
> 版本：v0.2-P0
> 复杂度：中
> 依赖：`openspec/api-spec.md`、`openspec/sql/knowledge-init.sql`
> 澄清记录：① 访客只读演示库采用「匿名只读接口 + 后端强制只读」；② 向量存储采用自定义 `knowledge_embedding` 表（方案A）
> 修订记录：见「变更记录表」
>
> ⚠️ 本文件为优化版，取代 `openspec/changes/p0/知识库设计PRD.md`（v0.1）。旧文件保留仅供对照，不再作为落地依据。

## 变更记录表

| 版本 | 变更点 |
|---|---|
| v0.1 | 初版（`openspec/changes/p0/知识库设计PRD.md`） |
| v0.2 | ✏️ 向量维度 `vector(1536)` → `vector(1024)`（对齐 qwen3.7-text-embedding-flash）；✏️ 中文全文检索 `english` → `simple`；✏️ 软删除与 `ON DELETE CASCADE` 语义理清（软删除 + 显式清理 embedding）；🆕 向量 HNSW 索引；🆕 `summary` 列；🆕 分块参数常量（512/64/top5）；🆕 访客机制澄清；🆕 双存储权威源澄清；🆕 向量存储选型说明；🆕 需核查的动态配置/环境点 |

## 1. 概述

### 1.1 背景
VeythCog（渡思）定位为个人一站式工作台，包含 AI 对话、知识库、工具集。飞书作为主力大容量归档知识库；本模块为**轻量化 RAG 实验库**，承载碎片笔记、技术踩坑、Prompt、代码片段，用于自用沉淀 + 面试项目演示。

编辑器升级为块级编辑器（BlockNote），对标语雀交互：块拖拽排序、`/` 唤起组件菜单；底层双存储：块 JSON 用于富交互，同步生成标准 Markdown，兼容导出、导入、RAG 切片。

### 1.2 目标
1. P0 交付最小可用知识库：文档 CRUD、块级编辑、md 导入导出
2. 支持私有库（自用）、演示库（访客只读、面试演示）物理隔离
3. 打通 AI 对话模块：选择文档集合做 RAG 检索、引用溯源
4. 架构预留扩展点：批量操作、块级元数据、飞书索引层
5. 适配轻量云服务器：控制存储/向量资源，手动管控向量化，不自动 embedding

### 1.3 范围
✅ P0 包含：知识库总览页、块编辑器文档页、md 导入/导出、AI 对话侧知识库选择抽屉、RAG 召回溯源、权限隔离、向量化开关、文档-向量级联删除、数据模型、接口、关键词检索。

⏳ P2 预留（只定义扩展位点，不实现）：批量操作、块级元数据/块级向量化、RAG 参数可视化面板、文档版本快照。

⏳ P3 路线B（远期）：飞书开放平台索引层（同步标题+摘要+向量，原文跳转飞书）。

🔴 不在本模块范围：图片/附件上传（仅外链）、PDF 解析/大文件预览、多人实时协同、飞书全量自动同步。

### 1.4 约束
1. 存储：仅文本；单文档上限 500KB；不存储二进制附件
2. 向量策略：**保存文档 ≠ 自动向量化**，由用户手动触发；文档变更后需重新向量化
3. 资源约束：轻量 PG；列表页只做 PG 文本关键词检索，向量检索仅在对话 RAG 场景触发
4. 格式约束：块结构与 Markdown 双向同步，导出为标准 md
5. 权限约束：访客仅可访问演示库、只读；演示库文档锁定编辑

## 2. 角色与权限

| 角色 | 私有库 | 演示库 | 说明 |
| ---- | ---- | ---- | ---- |
| 访客（未登录） | 不可见 | 只读（浏览、RAG 问答） | 无编辑/上传/向量化 |
| 登录用户（本人） | 读写全权限 | 只读锁定 | 演示库文档禁止编辑，仅浏览与 RAG 测试 |

> ⚠️ **访客机制澄清（v0.2 新增）**：当前后端 `SecurityConfig` 是 `anyRequest().authenticated()`，角色只有 `admin/user`，**没有匿名/guest 会话**。落地采用：`SecurityConfig` 放行 `GET /api/knowledge/demo/**`（演示库只读），其余 `/api/knowledge/**` 需登录；写接口内再校验 `libType=demo` 一律 `FORBIDDEN_ERROR`。权限统一在后端校验，前端仅做 UI 隐藏，不可信任前端判断。

## 3. 页面 & 路由设计

| 路由 | 页面 | 说明 |
| ---- | ---- | ---- |
| `/knowledge` | 知识库总览页 | 库切换、搜索筛选、文档列表、新建/上传入口 |
| `/knowledge/doc/new` | 新建文档编辑器页 | 新建空白文档 |
| `/knowledge/doc/:docId` | 文档编辑/预览页 | 块编辑器、元信息面板 |
| 弹窗（非独立路由） | md 导入弹窗 | 拖拽上传 md，解析为块结构 |
| AI 对话内抽屉 | 知识库选择器 | 选择文档集合，绑定本次对话 RAG 上下文 |

### 3.1 知识库总览页
1. 顶部：面包屑、库切换下拉（`私有库/演示库`，数据与向量隔离）、【新建文档】【上传MD】
2. 筛选&搜索：关键词搜索（PG `simple` 文本检索匹配 `markdown_text`）、标签筛选、排序下拉、状态筛选（全部/已向量化/未向量化）
3. 视图切换：卡片视图（默认）/ 列表视图
4. 列表项字段：标题、**摘要（`summary`，v0.2 新增列）**、标签、更新时间、向量化标记 ✅；单条操作：查看/编辑/向量化/取消向量化/导出/删除；复选框占位（P2 批量）
5. 底部统计：当前库文档总数、已向量化文档数量

### 3.2 文档编辑页（BlockNote 块编辑器）
- 左侧元信息面板：归属库、标签、向量化开关、创建/更新时间；演示库文档全部编辑控件锁定
- 主画布：块基础单元（段落/H1-H3/无序/有序列表/引用/代码块/分割线/待办/提示块）、拖拽柄、`+` 新增、`/` 斜杠命令、`Shift+Enter` 软换行
- 双向同步：块变更 → 实时序列化生成 `markdown_text`
- 数据模型：`block_data jsonb`（权威源）+ `markdown_text text`（派生缓存）

> ⚠️ **双存储权威源（v0.2 澄清）**：`block_data` 为权威源，`markdown_text` 为派生缓存。前端实时序列化生成，后端导入时由后端解析生成；保存时以 `block_data` 为准，避免两套逻辑漂移。

### 3.3 md 导入弹窗
- 拖拽/选择 `.md`，选择归属库、自动提取标题、标签输入；单文件 ≤500KB，仅 `.md` 后缀
- 流程：前端上传 → 后端解析 markdown → 转 block 数组写 `block_data`，回填 `markdown_text`；成功后提示是否立即向量化

### 3.4 AI 对话 - 知识库选择抽屉（RAG 绑定）
- 抽屉内库切换、文档复选列表；确认后本次对话临时绑定文档集合；会话隔离（下次默认不继承，记忆上次选中）；访客只能勾选演示库文档

## 4. 数据模型设计（PG，修正后）

> 完整建表脚本见 `openspec/sql/knowledge-init.sql`。此处仅列关键修正点。

```sql
CREATE EXTENSION IF NOT EXISTS vector;  -- 前置：目标库必须已启用 pgvector

CREATE TABLE knowledge_doc (
    id            BIGSERIAL PRIMARY KEY,
    lib_type      VARCHAR(20)  NOT NULL,                -- private / demo
    title         VARCHAR(255) NOT NULL,
    summary       VARCHAR(500) NOT NULL DEFAULT '',     -- 🆕 v0.2 列表页摘要
    tags          TEXT[]       NOT NULL DEFAULT '{}',
    block_data    JSONB        NOT NULL DEFAULT '[]'::jsonb, -- 权威源
    markdown_text TEXT         NOT NULL DEFAULT '',     -- 派生缓存
    is_vectorized BOOLEAN      NOT NULL DEFAULT false,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    deleted       BOOLEAN      NOT NULL DEFAULT false
    -- 【扩展预留】owner_id BIGINT REFERENCES app_user(id)  -- 多用户时补
);

CREATE TABLE knowledge_embedding (
    id          BIGSERIAL PRIMARY KEY,
    doc_id      BIGINT NOT NULL REFERENCES knowledge_doc(id) ON DELETE CASCADE,
    chunk_index INT    NOT NULL,
    chunk_text  TEXT   NOT NULL,
    embedding   vector(1024) NOT NULL,                  -- ✏️ v0.2 1536→1024
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (doc_id, chunk_index)
);

-- 索引
CREATE INDEX idx_knowledge_doc_lib_deleted ON knowledge_doc(lib_type, deleted);
CREATE INDEX idx_knowledge_doc_text_gin ON knowledge_doc USING gin(
    to_tsvector('simple', title || ' ' || coalesce(summary,'') || ' ' || coalesce(markdown_text,''))
);  -- ✏️ v0.2 'english'→'simple'（中文分词）
CREATE INDEX idx_knowledge_embedding_doc ON knowledge_embedding(doc_id);
CREATE INDEX idx_knowledge_embedding_vec ON knowledge_embedding USING hnsw(embedding vector_cosine_ops); -- 🆕 v0.2
```

### 4.1 关键修正说明（相对 v0.1）
| 修正点 | 原因 |
|---|---|
| ✏️ `vector(1024)` | 项目实际 Embedding 为 `qwen3.7-text-embedding-flash` + `dimensions:1024`，1536 是 OpenAI 维度，写入会报错 |
| ✏️ `simple` 检索 | 内容是中文，`english` 不切中文词，GIN 索引失效 |
| ✏️ 软删除语义 | 软删除不触发 FK 级联，需接口显式清理 embedding |
| 🆕 HNSW 向量索引 | 无向量索引则相似度检索全表扫描 |
| 🆕 `summary` 列 | 列表页要展示摘要，原表缺列 |

## 5. 向量化与检索方案（选型说明）

### 5.1 选型：自定义 `knowledge_embedding` 表（方案A）
**理由**：PRD 需要 `is_vectorized` 手动开关、doc 级软删除、`lib_type` 物理隔离、文档级生命周期，这些语义用 Spring AI `PgVectorStore` 的 metadata 过滤也能做但更绕；自定义表对面试更好讲「pgvector 原生用法」。

**备选方案B**：Spring AI `PgVectorStore` + `QuestionAnswerAdvisor`（复用现成检索，代码少，与 `vc-learn/examples/rag` 同构）。代价：表结构由 Spring AI 托管，与 `knowledge_doc` 解耦，需用 metadata（`docId`/`libType`）模拟隔离与删除。

> 决策：P0 走方案A；若后续想快速验证，可先按 `vc-learn` 示例用 `PgVectorStore` 做原型，再迁移到自定义表。

### 5.2 分块与检索参数（常量，与 `docs/architecture.md` 对齐）
| 参数 | 值 |
|---|---|
| CHUNK_SIZE | 512（字符） |
| CHUNK_OVERLAP | 64（字符） |
| TOP_K | 5 |

### 5.3 检索流程
```
查询文本 → EmbeddingModel(query) → ORDER BY embedding <=> $query LIMIT topN
        → 强制按 lib_type 过滤（不跨库混合召回）→ 返回 chunkText/docId/title/score
```

## 6. 接口清单（RESTful）

> 完整契约（字段/错误码/权限矩阵）见 `openspec/api-spec.md`。此处列骨架。

| # | 接口 | 说明 |
|---|---|---|
| 1 | `GET /api/knowledge/list` | 分页列表，关键词走 `simple` 文本检索 |
| 2 | `GET /api/knowledge/doc/{docId}` | 详情（元信息 + block_data + markdown_text） |
| 3 | `POST /api/knowledge/doc` | 新建 |
| 4 | `PUT /api/knowledge/doc/{docId}` | 更新；演示库 403 |
| 5 | `DELETE /api/knowledge/doc/{docId}` | 软删除 + 显式清理 embedding |
| 6 | `POST /api/knowledge/import/md` | 导入 md（≤500KB，仅 .md） |
| 7 | `GET /api/knowledge/doc/{docId}/export/md` | 导出 md 下载流 |
| 8 | `POST /api/knowledge/doc/{docId}/vectorize` | 切片→embedding→先删后插→置 true |
| 9 | `POST /api/knowledge/doc/{docId}/unvectorize` | 删除全部 embedding，置 false |
| 10 | `POST /api/knowledge/rag/retrieve` | RAG 召回（docIds/query/topN） |

> 扩展预留（P0 不实现）：`batch/vectorize`、`batch/move`、`batch/tag`、`batch/delete`。

## 7. 编辑器组件规范（BlockNote）

### 7.1 P0 内置块类型（斜杠菜单）
段落、H1/H2/H3、无序/有序列表、引用块、代码块（java/js/sql/markdown）、分割线、待办复选框、提示块（callout）。

### 7.2 转换规则与有损边界（v0.2 明确）
1. `blockData → markdownText`：前端实时序列化，每次块变更触发
2. `markdownText → blockData`：导入 md 时后端解析转换
3. 一致性：导出 md 重新导入，块结构尽量一致；**明确有损项**：callout/待办/代码块语言等 BlockNote 非标准 Markdown 语法在往返中可能降级，需在测试用例覆盖
4. 约束：不支持图片上传，图片块仅外链 url 占位（P2 扩展）

> ⚠️ **依赖现状（v0.2 新增）**：前端 `package.json` 目前无 `@blocknote/*`（仅 react-markdown），需新增 `@blocknote/core` + `@blocknote/react` + UI 包（`@blocknote/mantine` 或 `@blocknote/shadcn`）；与 AntD 5 体系并存需处理样式与体积，知识库路由懒加载编辑器 bundle。

## 8. 交互规则
1. 向量化：手动触发；文档修改后前端提示「内容已变更，向量索引非最新」
2. 库隔离：私有库、演示库数据与向量完全分开；RAG 检索不跨库混合召回
3. 保存：编辑器点击保存才落库，自动保存 P0 不做（P2 可选）
4. 斜杠菜单：输入 `/` 弹出，输入字符过滤；光标不在块内不触发
5. 拖拽：仅同文档内块上下排序，不支持跨文档拖拽（P2 扩展）

## 9. 备份 & 运维规范（适配轻量服务器）
1. PG 定时 dump：每日全量导出，备份包推送对象存储，不在本机长期留存
2. 备份内容：`knowledge_doc` + `knowledge_embedding`；md 原文已在 `markdown_text` 内
3. 迁移：新环境导入 pg dump 恢复文档与向量；向量可重建（embedding 可重算数据）
4. 灾备底线：业务正本在飞书；本库为实验/碎片副本，向量丢失可重新向量化
5. ⚠️ 实际库为个人服务器 docker 容器（pgvector/pgvector:pg16），备份/迁移按该容器库编写

## 10. 测试用例要点（P0 验收）
1. 新建文档、拖拽块、斜杠插入组件，保存后正常回显
2. 导入 md → 解析为块；导出 md，内容一致（含 callout/待办/代码块的有损边界用例）
3. 私有库文档：登录用户可编辑；访客看不到（401）
4. 演示库文档：访客只读，编辑控件锁定；写接口后端 403
5. 文档向量化、取消向量化；RAG 召回片段携带来源引用
6. 修改文档后提示向量过期；删除文档，embedding 显式级联清除（软删除路径）
7. 超大小文件、非法后缀 md 上传拦截（40000）
8. 向量维度校验：写入 `vector(1024)` 不报维度错误

## 11. 风险与降级方案
1. 块 ↔ md 双向转换异常：保留原始 `markdown_text`，编辑器可切纯 md 预览模式
2. embedding 调用超限/超时：向量化接口加超时、失败提示，不阻塞文档保存
3. 轻量机 CPU 压力：不自动向量化，手动控制；禁止列表页向量检索
4. BlockNote 打包体积：知识库路由懒加载编辑器 bundle
5. 中文分词精度：P0 用 `simple` 兜底；若检索体验差，P2 评估 zhparser/jieba 扩展（权衡运维复杂度）

## 12. 面试亮点说明（可直接放进 README）
> 知识库采用块级编辑器，对标语雀交互，支持块拖拽重排、`/` 斜杠快捷插入组件；双存储设计：JSON 块结构支撑富交互，同步生成标准 Markdown，兼顾编辑体验、格式兼容与 RAG 检索。
> 架构上区分私有库与演示库，物理隔离数据与向量；向量存储用 pgvector 原生 `vector(1024)` + HNSW 余弦索引，手动管控向量化；预留批量操作、块级向量、飞书索引层扩展位点；定位轻量化 RAG 实验库，主力文档归档飞书，减轻自建存储/备份压力，适配轻量服务器资源约束。

## 13. 动态配置/环境点（3 项已确认，1 项待落地）

> 以下不是代码默认值，是运行时/环境事实，结论依赖其真实值（准则一）。

1. ✅ **Embedding 模型与维度**：保持 `qwen3.7-text-embedding-flash` + `1024`（用户 2026-11-06 确认），与 `vector(1024)` 一致。
2. ✅ **pgvector 扩展**：目标库已迁到个人服务器 docker 容器，已启用 `CREATE EXTENSION IF NOT EXISTS vector;`（用户 2026-11-06 确认）。
3. ✅ **数据库连接串**：实际 datasource 为个人服务器 docker 容器（非 Supabase 云端）；备份/迁移方案按该容器库编写。
4. **访客只读路径**：需在 `SecurityConfig` 放行 `GET /api/knowledge/demo/**`，并确认 JWT 过滤器对未登录请求不拦截（当前 `anyRequest().authenticated()` 需改）。

## 14. 附录：落地依赖缺口（编码前必须补）
- 后端 `vc-knowledge/pom.xml`：补 `spring-ai-alibaba-starter-dashscope`（拿 `EmbeddingModel`）、`postgresql`；`Document`/`KnowledgeBase` 实体需加 JPA 注解，`KnowledgeServiceImpl` 需实现。
- 前端 `package.json`：补 `@blocknote/*` 依赖。
- SQL：执行 `openspec/sql/knowledge-init.sql`（`ddl-auto=none`，表靠脚本管理）。
