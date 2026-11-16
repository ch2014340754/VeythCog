# VeythCog 划词 AI + 网页剪藏 PRD

> 文档路径：`openspec/quick-ai-clip-prd.md`
> 需求名：全局划词 AI（Quick Actions）+ 网页剪藏与收件箱（Web Clip / Inbox）（P2）
> 技术栈：React 18 + TS + Vite + AntD 5 + Zustand + Iconify / Spring Boot 3.5 + Java 21 + MyBatis-Plus + PostgreSQL 16
> 模块：前端 `components/SelectionAsk` + `pages/Inbox` + `pages/Settings`；后端 `vc-knowledge`（新增 `clip` 子包）+ `vc-app/web`（新增 `QuickAiController`、`ClipController`）
> 版本：v0.1-P2（待评审）
> 复杂度：中偏高（两个特性、一条跨域写入链路）
> 依赖：`openspec/api-spec.md`、`vc-chat` 的 `ChatService.streamChatStateless`（AI 搜索 `SearchController` 已有先例）、`vc-llm` 的 `LlmModelService.getDefaultModel`、`vc-knowledge` 的 `DocService`（文档落库 + 向量化）、`vc-app/RagChatOrchestrator`、`SecurityConfig`

## 变更记录表

| 版本 | 变更点 |
|---|---|
| v0.1 | 初版：划词 AI 三层能力（通用解释 / 可选 RAG / 沉淀入库）+ 三路剪藏入口（粘 URL / 书签脚本 / 预留扩展）+ 收件箱页 + 独立剪藏令牌 |

## 1. 概述

### 1.1 背景

站点目前"内容进不来、内容也出不去"：

- **进来**：知识库只能靠手动新建文档 / 上传 md 文件；看到一篇好博客，得复制粘贴或下载文件再上传。
- **出去**：对话与知识库里的答案只能留在站内，看到有用的段落没法就地解释、翻译、落库。

本轮补两条最短链路：

1. **划词 AI**：站内任意页面选中一段文字 → 就地动作（解释 / 翻译 / 润色 / 存入知识库）。
2. **网页剪藏**：站外任意页面 → 一键把正文洗成干净 Markdown → 进「收件箱」→ 一键入知识库并向量化。

两者共用一套"文本 → 动作"的心智，但**不是同一个组件**：一个跑在站点内（选区浮层），一个跑在站点外（令牌写入）。

### 1.2 目标

1. 划词动作 ≤ 2 步完成（选中 → 点动作），首 token 出现 < 1.5s（默认模型直连、默认不检索）
2. 任意公网可访问的文章，粘 URL 即可入库，正文清洗后 Markdown 不含导航/广告/评论区
3. 书签脚本在博客页面一键剪藏，**不需要先打开本网站**
4. 剪藏进来的内容可"入库即向量化"，直接参与后续 RAG 对话
5. 视觉、动效、主题变量全部复用现有体系，不引入第二套设计语言

### 1.3 范围

✅ P2 包含：
- 全局选区浮层（`SelectionAsk`），4 个动作：解释 / 翻译 / 润色 / 存入知识库
- 流式结果卡（玻璃卡、可拖动、可关闭、可复制、可"追问转入对话"）
- 划词卡内「结合我的知识库」开关（手动触发 RAG）
- 收件箱页 `/inbox`：列表、预览、编辑标题/标签、入库、丢弃、删除
- 三路剪藏：收件箱粘 URL（服务端抓取）、书签脚本（页面 DOM 上报）、`POST /api/clip/capture` 开放给未来的扩展
- 设置页「剪藏令牌」：生成 / 复制 / 重置 / 撤销
- 入库联动：剪藏项 → `knowledge_doc` → 自动向量化

⏳ P2 预留位点（只定义，不实现）：RSS 订阅抓取、`p3` 浏览器扩展（Manifest V3）、剪藏项全文搜索、阅读进度/"稍后读"标记、TTS 朗读。

🔴 不在范围：网页截图 OCR、视频/播客转写、多用户共享收件箱、浏览器插件上架商店、离线缓存。

### 1.4 约束

1. **划词只读不写**：不允许在 `<input>` / `<textarea>` / `contenteditable` 内触发（避开对话输入框、编辑器），避免抢焦点。
2. **选区长度**：2 ~ 3000 字符。超长只取前 3000 并提示"已截断"；< 2 字符不出现浮层。
3. **不打断**：划词结果用浮层卡片，不弹 Modal；Esc / 点击卡片外即关闭，不写任何对话历史。
4. **不落库**：划词问答走 `streamChatStateless`，**不产生 `chat_message` 记录**（避免把一次性问答污染成会话）。
5. **抓取边界**：仅 `http/https`，禁止私网地址（`127.*`、`10.*`、`172.16-31.*`、`192.168.*`、`169.254.*`、`localhost`、IPv6 本地），防 SSRF；单页 ≤ 2MB、超时 8s、最多 3 次重定向。
6. **令牌与 JWT 分离**：书签脚本运行在第三方域名，拿不到 `localStorage` 里的 JWT，必须使用**独立剪藏令牌**（长期有效、可撤销、仅能写收件箱）。
7. **单账号配额**：收件箱 P2 上限 1000 条、正文单条 ≤ 2MB；单日抓取 ≤ 200 次（超限提示次日再试）。
8. **不存 S3**：剪藏正文直接落 PG `text`（≤2MB），不进对象存储，避免为小文本引入额外依赖。

## 2. 角色与权限

| 角色 | 划词 AI | 收件箱 / 剪藏 | 说明 |
|---|---|---|---|
| 未登录 | 不可用（浮层不出现） | 不可用 | 全站登录后才挂载 `SelectionAsk` |
| 登录用户 | 可用，共用本人默认模型 | 读写**本人**收件箱 | `clip_item.owner_id` 隔离，跨账号 40400 |
| 剪藏令牌 | — | 仅 `POST /api/clip/capture` | 令牌只用于写入，**不能读列表、不能删改**，泄露后果可控 |

> 令牌是"写口"，JWT 是"全文权限"。这个划分让书签脚本即使被复制走，最坏情况只是往你的收件箱里塞垃圾，不会读到你的知识库。

## 3. 页面 & 路由设计

| 路由 / 位置 | 说明 |
|---|---|
| 全局浮层（非路由） | `SelectionAsk`：选区工具条 + 流式结果卡 |
| `/inbox` | 收件箱页：剪藏列表 + 预览 + 入库动作 + 书签脚本获取入口 |
| `/settings`（Account 分页内新增一块） | 「剪藏令牌」生成/复制/重置 |
| `/settings`（Appearance 分页内新增开关） | 「划词 AI」总开关（默认开） |

`NAV_ITEMS` 追加 `{ path: '/inbox', icon: inboxIcon, label: '收件箱' }`（`src/config/navItems.ts` 是唯一权威，`HomeSidebar` 与 `MainLayout` 共用，本次**只改这一处**）。

### 3.1 划词工具条（`vc-selbar`）

- 触发：`mouseup` / `selectionchange` 防抖 180ms 后，若选区非空且不在输入控件内 → 在选区上方 8px 居中显示
- 尺寸：高度 32px，圆角 `--radius-full`，玻璃底（`--glass-bg` + `backdrop-filter: var(--glass-blur)`）
- 内容：`解释` `翻译` `润色` `存入知识库` 四个文字按钮 + 分隔线 + `⋯`（更多：复制 / 追问）
- 主动作高亮：鼠标首次进入时 `解释` 呈 `--color-primary` 描边（不是填充，避免抢视觉）
- 消失：选区清空 / 滚动超过 200px / Esc / 点击空白
- 移动端：**不启用**（长按选中的系统菜单与浮层冲突），仅在 `pointer: fine` 设备挂载

### 3.2 划词结果卡（`vc-askcard`）

- 位置：优先在选区右侧（视口足够），否则下方 12px；宽度 360px，`max-height: 60vh`
- 结构：头部（动作标签 + 模型名 + `结合知识库` 小开关） / 正文（流式 Markdown，代码块等宽字体） / 底部（复制、追问到对话、关闭）
- 流式：先出骨架行（3 条 2px 灰条），首 token 到达即替换；正文滚动跟随（用户手动上滚后停止跟随）
- 追问：把"选区 + 本次回答"作为一条新消息预填到 `/chat` 的 composer，**不自动发送**
- 结合知识库：开关打开后重发一次请求（保留上一次的原文），回答底部显示引用条目（文档标题，点击跳 `/knowledge`）

### 3.3 收件箱页（`/inbox`）

- 顶部：标题「收件箱」、副标题说明、右侧【粘贴链接】【获取书签】【导出全部 md】
- 粘贴链接：输入框 + 【抓取】按钮（抓取中按钮显示细进度条，列表保持不动）
- 主区：**列表优先**（表格），列：标题 / 来源域名 / 字数 / 抓取时间 / 状态（待处理 / 已入库 / 已丢弃）/ 操作（预览 / 入库 / 丢弃 / 删除）
- 预览：右侧抽屉（`vc-inbox__preview`），Markdown 渲染正文 + 原链接 + 原始 HTML 折叠区（只读）
- 入库：可选目标目录（复用知识库目录树）+ 标签，确认后创建文档并触发向量化，状态转「已入库」并显示 `doc_id` 链接
- 空态：一句说明 + 两个入口（粘贴链接 / 获取书签），不放大插画
- 筛选：全部 / 待处理 / 已入库 / 已丢弃；关键词只看标题

## 4. 剪藏管线设计

### 4.1 三路入口，一个出口

| 入口 | 谁在跑 | 请求 | 能抓到什么 |
|---|---|---|---|
| 粘 URL（站内） | 后端 | `POST /clip/url` | 公网匿名可访问页面 |
| 书签脚本（站外） | 页面 DOM → 上报 | `POST /clip/capture` | 同上，且正文更全（已渲染 DOM） |
| 扩展（预留 P3） | content script | `POST /clip/capture` | 含登录态内容 |

### 4.2 清洗管线（P2 统一在服务端）

```
① 取 HTML（URL 模式：RestTemplate/WebClient；capture 模式：直接用上报的 html）
② 安全校验：协议白名单、私网黑名单、大小/超时/重定向上限
③ 正文提取：readability4j（jsoup 内核）→ 取 title / byline / articleHtml
④ HTML → Markdown：flexmark-html2md-converter（保留标题层级/列表/代码块/图片外链/链接）
⑤ 归一化：去空行压缩、去追踪参数（`utm_*`/`spm`/`from=`）、图片链接转绝对地址
⑥ 摘要：取正文前 200 字（不做 AI 摘要，P2 优先省 token）
⑦ 落库：clip_item（status=pending）
```

失败降级：

| 情况 | 行为 |
|---|---|
| readability 提不到正文（解析出 < 200 字） | 回退"整页可读文本"（jsoup 去 script/style/nav/footer 后取 body 文本），标记 `quality=fallback` |
| 抓取超时 / 非 2xx | 仍落库一条**空正文**记录（保留 URL、标题、错误原因），列表显示「抓取失败·重试」 |
| 需要登录 / JS 渲染 | 提示"该页面抓不到正文，请用书签脚本"（书签脚本拿的是已渲染 DOM，能解决 90%） |
| 正文 > 2MB | 截断到 2MB 并在预览顶部提示 |

### 4.3 书签脚本

- 形态：收件箱页提供一段 `<a href="javascript:(function(){...})()">剪藏到渡思</a>`，用户**拖到书签栏**即可
- 令牌：生成时拼进脚本 URL（`?token=...`），重置令牌后旧书签失效（页面提示"重新拖一次"）
- 请求体：`POST {apiBase}/clip/capture`，`Content-Type: text/plain`（**简单请求，不触发预检**），body 为 JSON：
  `{ url, title, html（≤2MB，超出只传正文容器）, excerpt, selection? }`
- 页面反馈：脚本在目标页注入一个 32px 小 toast（"已收进渡思"），2 秒淡出，不改变原页面布局
- 注意：部分站点 CSP 会拦 `javascript:` 链接，此时只能退回"粘 URL"

## 5. 数据模型设计（PG）

> 建表脚本：`VeythCog-C/docs/sql/024_clip.sql`（`ddl-auto=none`，跟随现有编号；纯语句、幂等，不受 "按 `;` 切分" 的解析影响）

```sql
CREATE TABLE clip_token (
    id          BIGSERIAL PRIMARY KEY,
    owner_id    BIGINT      NOT NULL REFERENCES app_user(id),
    token_hash  VARCHAR(64) NOT NULL,             -- SHA-256(token)，明文只在生成时返回一次
    label       VARCHAR(100) NOT NULL DEFAULT '默认书签',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ,
    revoked     BOOLEAN     NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX uk_clip_token_hash ON clip_token(token_hash) WHERE revoked = false;
CREATE INDEX idx_clip_token_owner      ON clip_token(owner_id, revoked);

CREATE TABLE clip_item (
    id          BIGSERIAL PRIMARY KEY,
    owner_id    BIGINT       NOT NULL REFERENCES app_user(id),
    url         VARCHAR(1000) NOT NULL DEFAULT '',
    site        VARCHAR(200)  NOT NULL DEFAULT '',   -- 来源域名，列表展示用
    title       VARCHAR(300)  NOT NULL,
    byline      VARCHAR(200)  NOT NULL DEFAULT '',   -- 作者/站点名
    excerpt     VARCHAR(500)  NOT NULL DEFAULT '',
    content_md  TEXT          NOT NULL DEFAULT '',   -- 清洗后的 Markdown（正文权威格式）
    raw_html    TEXT,                                -- 原始 HTML，仅供"查看原文"折叠区，可清空
    word_count  INTEGER       NOT NULL DEFAULT 0,
    quality     VARCHAR(16)   NOT NULL DEFAULT 'ok', -- ok/fallback
    channel     VARCHAR(16)   NOT NULL DEFAULT 'url',-- url/bookmarklet/extension/manual
    status      VARCHAR(16)   NOT NULL DEFAULT 'pending', -- pending/archived/dropped
    error       VARCHAR(300)  NOT NULL DEFAULT '',
    tags        TEXT[]        NOT NULL DEFAULT '{}',
    doc_id      BIGINT,                              -- 入库后的 knowledge_doc id
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    deleted     BOOLEAN       NOT NULL DEFAULT false
);
CREATE INDEX idx_clip_item_owner  ON clip_item(owner_id, deleted, status, created_at DESC);
CREATE INDEX idx_clip_item_url    ON clip_item(owner_id, md5(url));
```

### 5.1 字段设计要点

| 设计 | 原因 |
|---|---|
| `token_hash` 而非明文 | 数据库泄露不导致令牌可用；明文只在生成接口返回一次 |
| `content_md` 为权威 | 后续所有消费（预览、入库、将来 TTS/TTS）都读 Markdown，HTML 只是审计用 |
| `raw_html` 可空 | 抓取大页面时内容占空间，入库后可清空（P2 提供"清理原文"按钮） |
| `doc_id` 回填 | 收件箱与知识库双向可追；同一个剪藏重复入库时提示"已入库" |
| `channel` | 统计入口效果；也是排查"为什么这篇正文不全"的第一线索 |
| `status` 三态 | 待处理/已入库/已丢弃，避免用"删除"表达"我读过不需要了" |

## 6. 接口清单

> 前缀统一 `/api`，响应 `{ code, data, message }`，时间为 epoch 毫秒。

### 6.1 划词 AI（`vc-app/web/QuickAiController`，前缀 `/api/ai`）

| # | 接口 | 说明 |
|---|---|---|
| 1 | `POST /api/ai/quick` | SSE 流式一次性问答。请求 `{ action: 'explain'\|'translate'\|'polish'\|'ask', text, pageTitle?, withKnowledge?, question? }`；事件顺序 `event: meta`（模型名/是否检索）→ `data: <token>` → `data: [DONE]`；失败 `event: error` |
| 2 | `GET /api/ai/quick/models` | 返回当前默认模型名（前端在卡头显示，无需额外配置） |

实现要点（复用现有，不新建 LLM 通路）：

- 模型：`LlmModelService.getDefaultModel(userId)`，为 `null` 时返回 40000「请先在设置里绑定可用模型」（与 AI 搜索一致）
- 调用：`ChatService.streamChatStateless(userId, vendor, modelCode, prompt)` —— **无记忆**，不写 `chat_message`
- 检索：仅当 `withKnowledge=true` 且账号存在已向量化文档时，`RagChatOrchestrator.retrieveAllSafely(userId, text)`，命中结果拼入 prompt，并以 `event: references` 下发
- prompt 规范（后端拼装，前端不可注入 system）：

| action | 指令 |
|---|---|
| `explain` | 用中文解释这段内容；先一句话结论，再列必要要点；代码需指出意图与风险 |
| `translate` | 中英互译（自动判向）；只输出译文，不解释、不加引号 |
| `polish` | 保持原意与语言不变，改得更简洁通顺；只输出改写结果 |
| `ask` | 以选中内容为上下文，回答 `question` |

> 输出上限：`max-tokens` 按 action 分别设（explain 800 / translate 1200 / polish 800 / ask 800），超出截断，不做长文。

### 6.2 剪藏（`vc-app/web/ClipController`，前缀 `/api/clip`）

| # | 接口 | 鉴权 | 说明 |
|---|---|---|---|
| 1 | `POST /api/clip/url` | JWT | `{ url }` → 抓取 + 清洗 + 落库，返回 `clip_item` 概要 |
| 2 | `POST /api/clip/capture?token=` | **剪藏令牌** | `Content-Type: text/plain`，body 为 JSON（url/title/html/excerpt/selection），返回 `{ id, title }` |
| 3 | `GET /api/clip/items` | JWT | 分页列表；参数 `status` `keyword` `current` `pageSize` |
| 4 | `GET /api/clip/items/{id}` | JWT | 详情（含 `content_md`、`raw_html`） |
| 5 | `PUT /api/clip/items/{id}` | JWT | 改标题/标签/状态（`pending`/`dropped`） |
| 6 | `POST /api/clip/items/{id}/to-knowledge` | JWT | `{ folderId?, tags?, vectorize? }` → 建 `knowledge_doc` 并（默认）触发向量化，回填 `doc_id` |
| 7 | `DELETE /api/clip/items/{id}` | JWT | 软删除（同时清 `raw_html`） |
| 8 | `POST /api/clip/tokens` | JWT | 生成令牌（返回明文一次） |
| 9 | `GET /api/clip/tokens` | JWT | 列出令牌（只回 `label` / `lastUsedAt` / `revoked`） |
| 10 | `DELETE /api/clip/tokens/{id}` | JWT | 撤销令牌 |
| 11 | `GET /api/clip/bookmarklet?token=` | JWT | 返回书签脚本片段（前端直接渲染成可拖拽链接） |

### 6.3 跨域与鉴权（关键技术点）

**问题**：书签脚本在 `https://some-blog.com` 上执行，请求 `https://www.veythcog.top/api/clip/capture`，当前 `SecurityConfig` 的 CORS 只放行 `https://www.veythcog.top` 与 `http://localhost:*`，会被浏览器直接拦掉。

**方案**：

1. `SecurityConfig` 增加**独立的 CORS 配置**，只注册到 `/api/clip/capture`：
   `allowedOriginPatterns("*")`、`allowedHeaders("Content-Type")`、`allowedMethods("POST", "OPTIONS")`、`maxAge(600)`
2. 该端点 `permitAll`（Spring Security 侧不认 JWT），**鉴权完全交给令牌**：查 `clip_token`（hash 比对 + 未撤销 + 归属），失败返回 40100
3. 请求用 `Content-Type: text/plain`，属于 CORS「简单请求」，**不触发预检**，脚本代码最短、最不容易被拦
4. 令牌走 query（`?token=`），并写入 `ApiAccessLogFilter` 日志时做掩码
5. 限流：同令牌 1 分钟 ≤ 10 条，超限 42900；同账号日累计 ≤ 200 条

> 取舍：给单一端点放开任意来源，风险面被三件事收窄——只能写入、必须持令牌、有频控与归属校验。**不要**把 `*` 放开到 `/**`。

### 6.4 SSRF 防护（抓取必做）

| 检查 | 规则 |
|---|---|
| 协议 | 仅 `http` / `https` |
| 主机 | 解析后 IP 落在私网/环回/链路本地/保留段 → 直接拒绝；域名解析失败同样拒绝 |
| 重定向 | 最多 3 跳，且**每跳重新做 IP 校验**（防"公网域名跳内网"） |
| 大小 / 时长 | 响应 ≤ 2MB、连接 4s、总超时 8s |
| 端口 | 仅 80 / 443 / 8080 / 8443 |
| UA | 固定标识 `VeythCogClipper/1.0 (+https://www.veythcog.top)` |

### 6.5 错误码（复用 `vc-common/ErrorCode`）

| code | 场景 |
|---|---|
| 40000 | 参数非法（URL 协议不对 / text 为空 / 选区超长 / 目标目录不存在） |
| 40100 | 剪藏令牌无效或已撤销 |
| 40400 | 剪藏项不存在 / 跨账号访问 |
| 42900 | 抓取频控超限 |
| 50001 | 抓取失败（超时、非 2xx、正文提取异常）→ 仍落一条 `error` 记录 |
| 50002 | 向量化失败（入库成功、向量失败，返回 `vectorized=false`） |

## 7. 前端实现规范

### 7.1 需要新增/修改的文件

| 文件 | 变更 |
|---|---|
| `src/api/quickAi.ts` | 新增：`quickAskStream`。SSE 解析**复用 `api/chat.ts#streamChatMessage` 的事件解析逻辑**（`event: references` / `event: token` / `data: [DONE]`），把它抽成共享函数（新建 `src/api/sseParse.ts`），**不改动现有 `api/sse.ts`**（那是 OpenAI 兼容直连的另一条通路） |
| `src/api/clip.ts` | 新增：`clipByUrl` / `listClips` / `getClip` / `updateClip` / `toKnowledge` / `removeClip` / `clipTokens` / `createClipToken` / `revokeClipToken` / `bookmarkletSnippet` |
| `src/components/SelectionAsk.tsx` | 新增：选区工具条 + 结果卡（受控于 `selectionAskStore`） |
| `src/stores/selectionAskStore.ts` | 新增：`enabled`（持久化）、`open/close`、`lastSelection` |
| `src/pages/Inbox/index.tsx` + `inbox.css` | 新增：收件箱页 |
| `src/pages/Settings/Account.tsx` | 新增"剪藏令牌"区块（生成/复制/撤销） |
| `src/pages/Settings/Appearance.tsx` | 新增"划词 AI"开关 |
| `src/config/navItems.ts` | 追加 `收件箱` 入口（唯一权威，两套侧栏自动同步） |
| `src/App.tsx` | 注册 `/inbox` 路由 + 挂载 `<SelectionAsk />` |
| `src/utils/pageTitle.ts` | 补 `/inbox` 标题 |

### 7.2 视觉与交互约束（必须遵守）

1. 浮层与卡片**一律用玻璃配方**：`--glass-bg` + `backdrop-filter: blur(var(--glass-blur)) saturate(180%)` + `--glass-border` 1px + `--shadow-lg`，与悬浮播放器同一手感
2. 颜色只用变量：`--color-primary`（主动作）、`--color-text-secondary`（辅助信息）、`--color-border`（分隔线），**禁止硬编码色值**；深色/浅色/6 套预设/毛玻璃开关都要自动跟随
3. 类名：`vc-selbar*` / `vc-askcard*` / `vc-inbox*`，BEM 两段式，不新增全局选择器
4. 圆角：工具条 `--radius-full`、结果卡 `--radius-lg`、收件箱表格行 `--radius-md`
5. 动效：工具条 120ms 淡入 + 4px 上移；结果卡 160ms 缩放 0.98→1；均 `transform/opacity`，不用 `height` 过渡
6. 图标按钮规格沿用现有 `icon-btn`（22px），与 `.vc-player__icon-btn` 一致
7. 破坏性操作（删除剪藏、撤销令牌）走 `Modal.confirm`，文案说明后果；确认框颜色已由 `.ant-modal-confirm` 规则主题化
8. 不使用 AntD `Popover`/`Tooltip` 承载划词工具条（层级与选中态冲突），自绘定位

### 7.3 无感规范落地（硬性）

| 场景 | 要求 |
|---|---|
| 划词请求 | 结果卡先出骨架，流式增量渲染；不出现整页 loading |
| 切换动作 | 同一次选区换动作时**复用同一张卡**，只清空正文重发（卡片不闪） |
| 收件箱抓取 | 列表保持旧内容，顶部 2px 细进度条；完成后原位插入新行 |
| 入库 | 行内状态从「待处理」原地转「已入库」，不整页刷新；向量化在后台继续，完成后静默更新角标 |
| 令牌生成 | 生成后弹一次"复制"提示（只显示一次，关闭即不可再查看） |
| 失败 | 一律轻提示 toast + 行内错误标记，不弹模态 |

## 8. 性能与配额

1. 划词：默认不检索（省 300~800ms）；`withKnowledge` 打开时才走 RAG
2. 选区工具条：`selectionchange` 事件防抖 180ms；只在 `pointer: fine` 且 `selectionAsk.enabled` 时挂监听，移动端零开销
3. 抓取：正文 ≤ 2MB、超时 8s；并发按账号排队（每账号同时 1 个抓取任务）
4. 收件箱列表：分页 20/页，正文不进列表响应（`content_md` 只在详情返回）
5. 剪藏正文占库估算：平均 30KB × 1000 条 ≈ 30MB，PG 完全hold住；`raw_html` 入库后可一键清空

## 9. 风险与降级

| 风险 | 降级方案 |
|---|---|
| 站点 CSP 拦 `javascript:` 书签 | 收件箱保留"粘 URL"入口；提示改用扩展（P3） |
| 令牌被复制到别处 | 令牌只能写、有频控、可一键撤销；撤销后旧书签立即失效 |
| SSRF（用户粘内网地址） | IP 白名单校验 + 每跳重定向复检 |
| readability 对某些站点失效 | 回退整页文本（`quality=fallback`），列表标注，允许手工编辑 Markdown |
| 剪藏正文乱码 | 响应按 `Content-Type` charset 解码，缺省 UTF-8；失败提示改用书签脚本 |
| 划词与页面其他选区交互冲突 | 输入控件内不触发；卡片打开时禁止再次触发（点击卡外才复位） |
| 模型未绑定 | 卡内直接显示"先去设置绑定模型"的跳转，不发请求 |
| 结果卡遮挡内容 | 支持拖动（复用播放器的 `offsetY` 拖动惯性），并且点击卡外即关 |

## 10. 测试用例要点（P2 验收）

**划词**
1. 知识库页选中一段正文 → 出现工具条 → 点「解释」→ 1.5s 内出首字 → 内容准确、Markdown 正常
2. 在对话输入框里选中文字 → **不出现**工具条（不抢焦点）
3. 选中 4000 字 → 发送前截断到 3000 并提示
4. 打开「结合知识库」→ 命中引用 → 底部出现引用条目，点击可跳文档
5. 按 Esc / 点空白 → 卡片消失；再次选中同一段可重新触发
6. 「存入知识库」→ 落成一篇文档且可向量化（与手动新建结果一致）
7. 未登录 → 浮层不出现；未绑定模型 → 卡内提示去设置

**剪藏**
8. 粘一个技术博客 URL → 正文无导航/评论区/推荐位，标题/作者正确，`word_count` 合理
9. 粘 `http://127.0.0.1:8123/api/health` / `http://169.254.169.254/` → 直接拒绝（40000）
10. 拖书签脚本到书签栏 → 在第三方博客页点击 → 3 秒内收件箱出现该条（`channel=bookmarklet`）
11. 令牌撤销后再点旧书签 → 40100，页面 toast 提示"令牌已失效"
12. 抓一个需要登录的页面（URL 模式）→ 落库 `error` 记录，提示改书签脚本
13. 剪藏项「入库」→ 知识库出现新文档 + 自动向量化 → 收件箱状态转「已入库」并显示 doc_id
14. 同一条重复入库 → 提示"已入库"，不产生第二篇文档
15. 删除剪藏项 → 列表消失、`raw_html` 清空、知识库文档**不受影响**
16. 收件箱 1000 条上限 → 第 1001 条拒绝并提示清理

**主题与视觉**
17. 深色主题下工具条、结果卡、收件箱表格文字对比度足够（正文不低于 `--color-text`，说明文字 `--color-text-secondary`）
18. 打开毛玻璃开关 → 三处浮层都呈现毛玻璃，且不出现文字发灰

## 11. 落地依赖缺口（编码前必须补）

1. **后端依赖**：`vc-knowledge/pom.xml` 新增 `org.jsoup:jsoup`（DOM 解析）、`net.dankito.readability4j:readability4j`（正文提取）、`com.vladsch.flexmark:flexmark-html2md-converter`（HTML→Markdown）；均已在阿里云镜像可获取
2. **模块归属**：剪藏放在 **`vc-knowledge` 内的 `com.vc.knowledge.clip` 子包**（直接复用 `DocService` 建文档，避免"跨模块调用还要过 HTTP"）。**不新增 `vc-clip` 模块** —— 如果将来长出 RSS/稍后读/全文检索再拆；届时必须同步改 `Dockerfile`（COPY + 逐模块 install 顺序），这条已在 `PROJECT_MEMORY.md` 记过
3. **SQL**：`docs/sql/024_clip.sql`（在 023 之后编号；纯语句 + 幂等，适配"按 `;` 逐句执行"的跑法）
4. **安全配置**：`SecurityConfig` 增加 `/api/clip/capture` 的独立 CORS 与 `permitAll`；`ApiAccessLogFilter` 对 `token` 参数做掩码
5. **配置项**（`application.yml`）：`clip.fetch.max-bytes=2MB`、`clip.fetch.timeout-ms=8000`、`clip.daily-limit=200`、`clip.token-rate-limit=10/分钟`；`quickAi.max-tokens-*`（按动作）
6. **前端依赖**：无新增（`react-markdown@^9.1.0` 已在 `package.json` 内，对话页已用于渲染；划词结果卡与剪藏预览直接复用同一套渲染配置，含代码块高亮）
7. **mvn 构建**：本地验证用 `JDK21 + D:\maven\...\mvn.cmd`，注意 PATH 先补 `C:\Windows\System32`（否则 `'cmd' is not recognized`）

## 12. 待确认决策（请评审时逐条确认）

| # | 决策点 | 建议 | 备选 |
|---|---|---|---|
| 1 | 划词动作清单 | **解释 / 翻译 / 润色 / 存入知识库** 四个 + 更多菜单（复制、追问） | 只留解释+翻译，最轻 |
| 2 | 「结合知识库」默认状态 | **默认关**（快），手动开（准） | 默认开（更"AI"但慢） |
| 3 | 划词是否落库对话历史 | **不落库**（`streamChatStateless`） | 落成"划词记录"供以后回溯 |
| 4 | 剪藏代码位置 | **`vc-knowledge` 子包** | 新建 `vc-clip` 模块（更重，需改 Dockerfile） |
| 5 | 收件箱入口 | `NAV_ITEMS` 追加「收件箱」，侧栏平级 | 放进 `/tools` 或 Settings |
| 6 | 剪藏正文存哪 | **PG `text`** | S3 私有桶 `clip`（为将来大文件预留） |
| 7 | 令牌形态 | **独立长期令牌（写口）** | 复用 JWT（书签脚本实际上拿不到，不可行） |
| 8 | 抓取失败是否落库 | **落库（带 error）**，可重试 | 直接报错不留痕 |
| 9 | P2 是否做扩展 | **不做**，只留 `capture` 接口 | 同步做 unpacked 扩展（+2~3 天） |
| 10 | 划词移动端 | **不启用**（避免长按菜单冲突） | 启用但用长按触发 |

## 13. 面试亮点说明（可直接放进 README）

> 划词 AI 没有新建一条 LLM 通路，而是复用已有的 **stateless 流式对话**（`ChatService.streamChatStateless`）——一次性问答不写对话记忆，避免污染 `chat_message`；知识库检索做成**卡内手动开关**，在「快」与「准」之间把选择权交给用户，默认路径 1.5s 内出首字。网页剪藏的关键不是"点一下"，而是把**外站内容安全地写进内网站点**：书签脚本运行在第三方域名，拿不到 `localStorage` 里的 JWT，因此设计了**只可写、可撤销、带频控的剪藏令牌**，并给单一端点开最小化 CORS（`text/plain` 简单请求不触发预检）；抓取侧做了 **SSRF 防护**（协议白名单 + 解析 IP 私网校验 + 每跳重定向复检 + 大小/超时上限）。清洗链路用 readability4j 提正文、flexmark 转 Markdown，抓不到正文时降级为整页文本并标记 `quality`，保证"宁可粗糙也不丢"。

## 14. 与 OpenSpec 的落地映射

评审通过后按下表拆分为 OpenSpec change（目录命名对齐现有 `changes/p2-xxx` 风格）：

| 产物 | 路径 |
|---|---|
| 变更提案 | `openspec/changes/p2-quick-ai-clip/proposal.md` |
| 技术设计 | 同上 `/design.md`（含 CORS 最小化、令牌模型、SSRF 校验、清洗管线） |
| 任务拆分 | 同上 `/tasks.md`（划词 5 项 / 剪藏 7 项 / 收件箱 4 项 / 验证 3 项） |
| 能力规格 | 同上 `/specs/quick-ai/spec.md`、`/specs/web-clip/spec.md` |
| 接口契约 | 追加到 `openspec/api-spec.md`（`/ai/quick`、`/clip/**` 共 11 条） |

## 15. 建议的落地顺序（供排期参考）

| 阶段 | 内容 | 预估 |
|---|---|---|
| S1 | 后端 `/ai/quick` + 前端库 `quickAi.ts` + 选区浮层（解释/翻译/润色） | 1 天 |
| S2 | "存入知识库" + 结果卡打磨（引用/追问/拖动）+ 设置开关 | 0.5 天 |
| S3 | `024_clip.sql` + 令牌表/接口 + `POST /clip/url` 抓取清洗管线（含 SSRF 校验） | 1 天 |
| S4 | 收件箱页 + 入库联动 + 令牌管理 UI | 1 天 |
| S5 | 书签脚本 + 跨域最小化 CORS 联调 + 真站冒烟 | 0.5 天 |
