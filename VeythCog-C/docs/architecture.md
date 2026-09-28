# VeythCog-C 架构与开发路线

> 本文档是 VeythCog-C（后端）的设计说明与阶段拆解，作为个人开发与面试讲解的蓝本。

## 一、总体架构

```
                    ┌──────────────────────────────────────────────┐
                    │               VeythCog-V（前端）              │
                    │  React 18 · TS · Vite · AntD 5 · Zustand      │
                    └──────────────┬───────────────────────────────┘
                                   │ HTTP / SSE（OpenAI 兼容）
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    VeythCog-C（后端 · 端口 8123 · /api）              │
│  ┌──────────┬───────────┬─────────────┬───────────┬──────────────┐  │
│  │ auth     │ chat      │ llm-gateway │ knowledge │ health       │  │
│  │ JWT 认证 │ 会话/消息  │ ★模型调度    │ ★RAG 知识库 │ 健康检查     │  │
│  └──────────┴───────────┴─────────────┴───────────┴──────────────┘  │
│                        │                              │              │
│               Spring AI Alibaba(DashScope)      PostgreSQL+pgvector │
│               OpenAI 兼容多供应商(规划)         业务表 + 向量检索       │
└─────────────────────────────────────────────────────────────────────┘
```

**设计原则**：单体轻量化（不搞微服务）；前后端解耦、契约先行；单库两用（PostgreSQL + pgvector 同时承载业务表与向量），少一个组件。

**当前实现形态：模块化单体（Modular Monolith）**。域能力拆为库模块，由唯一可运行应用 vc-app 装配：

```
vc-common(公共基础) → vc-llm(LLM 调度网关/模型管理) → vc-chat(对话域) / vc-knowledge(知识库域) → vc-app(唯一可运行)
```

- 依赖方向单向：`common ← llm ← (chat, knowledge) ← app`；chat 与 knowledge 相互不依赖。
- 仅 vc-app 可运行（端口 8123，`/api`）；其余为纯库（无 boot 插件、无 main）。
- 上图的能力落到包/模块：`auth`、`web`(Controller)、`admin`(系统管理)、`orchestration`(RAG 编排) 在 vc-app；`llm-gateway` 在 vc-llm；`knowledge` 域在 vc-knowledge；`chat` 域在 vc-chat。
- RAG 组合动作在 vc-app 的 orchestration 层完成（检索→拼上下文+引用→作答），域之间不互相 import。

## 二、三大深水区（面试核心）

### 1. llm-gateway · 多模型调度网关（Phase 1）

把"多供应商、多模型"抽象成一层网关，业务层不直接碰具体模型：

- **供应商抽象**：统一 OpenAI 兼容协议（baseUrl + apiKey + 模型列表），覆盖 DeepSeek / Kimi / Qwen / OpenAI。
- **模型路由**：手动选择 + 策略路由（错误/限流自动降级到备用模型）。
- **可靠性**：超时、重试、降级；并发限制。
- **可观测**：每次调用记录 token 用量、延迟，支撑成本与质量分析。

> 面试讲点：为什么用 OpenAI 兼容协议做抽象？降级策略怎么设计？SSE 为什么不用 WebSocket（单向、可带 Authorization、SSE 语义天然匹配流式）？

### 2. RAG · 检索增强管线（Phase 2）

```
文档上传 → 解析(txt/md/pdf) → 分块(chunk) → Embedding(API/Ollama)
       → pgvector 存储(带 kb_id/doc_id/chunk_index 元数据)
查询 → 问题 Embedding → top-k 相似度检索 → 拼上下文 → 调 LLM → 带引用回答
```

- **分块**：v1 定死 `512 字 + 64 重叠 + top-k 5`，不引入 rerank，达标即止（防无限调优）。
- **引用**：回答附来源（文档名/片段），前端渲染引用卡片。
- **检索调试页**：前端可视化展示命中片段与打分，作为演示亮点。

> 面试讲点：分块策略与重叠的意义；pgvector 为什么够用（对比专用向量库）；检索质量如何验证。

### 3. SSE · 流式全链路（Phase 1）

- 前端已封装 `streamChat()`（fetch + ReadableStream，支持 AbortController 中断）。
- 后端用 Spring MVC `SseEmitter` 逐 token 下发，保留中断语义。
- 消息落库（流式期间先建草稿，结束后补全），刷新不丢对话。

> 面试讲点：SSE 中断如何传导到后端取消模型调用；消息持久化的时机与一致性。

## 三、四阶段开发路线

| 阶段 | 交付物（可演示） | 验收标准 |
|---|---|---|
| **Phase 0** | ① 真 JWT 登录（jjwt + BCrypt + 用户表）② OpenAPI 契约 ③ docker-compose(pgvector) ④ 前端登录切真实接口 | 能登录、能一键起 DB 的骨架 |
| **Phase 1** | ① llm-gateway（供应商抽象+路由+降级）② SSE 流式代理 ③ 会话/消息持久化 ④ 前端切真实对话+模型选择+中断 | 2+ 模型可切换的真实流式对话 |
| **Phase 2** | ① 文档上传→解析→分块→Embedding→pgvector ② 检索+引用 ③ 前端知识库真实数据+引用卡片+检索调试页 | "问我的知识库"带引用可用 |
| **Phase 3** | ① Docker 全栈+种子数据 ② 架构图/指标 ③ 核心单测 ④ 演示脚本 | 一键启动的完整作品集 |

**防烂尾铁律**：每阶段 ≤ 3 周，超时砍范围不砍质量；每阶段结束都能截图/演示。

## 四、关键选型与理由

| 决策 | 选型 | 理由 |
|---|---|---|
| 数据库 | PostgreSQL 16 + pgvector | 一个库装业务表 + 向量，轻量化；RAG 刚需 |
| 流式 | Spring MVC + SseEmitter | 简单可控、面试好讲；v1 不上 WebFlux |
| 鉴权 | JWT（jjwt + BCrypt） | 轻量、无状态；不搞 OAuth2 全套 |
| 异步 | 线程池 + 任务表 | 替代 MQ，还能讲"离线任务" |
| Embedding | v1 调 API；v2 可选 Ollama 本地 | 本地+云端混合调度 = 现成加分叙事 |
| 模型 | DeepSeek / Kimi / Qwen / OpenAI | 全走 OpenAI 兼容，网关一次抽象覆盖 |

## 五、待办落地顺序（Phase 0 优先）

1. 引入 `spring-boot-starter-security` + `jjwt` + `spring-boot-starter-data-jpa` + `postgresql`。
2. 启用 `application-local.yml` 中注释的 datasource（配 docker 里的 pgvector）。
3. 实现 `AuthServiceImpl`：BCrypt + JWT 签发 + `/auth/me`。
4. 写 OpenAPI 契约文档，与 VeythCog-V 前端对接清单对齐。

## 六、P0 落地记录（2026-09，MySQL 先行）

> 设计仍以 PostgreSQL 为目标，但本机开发先用 MySQL 打通（用户要求），SQL 脚本保留迁 PG 差异注释。

**已完成（P0 前后端串联闭环）**：
- 鉴权：真 JWT（jjwt 0.12.6）+ BCrypt（后端 `PasswordUtil`）；`/api/auth/login`，admin/admin123。
- 模型管理：供应商为枚举（dashscope / deepseek）+ 用户-模型绑定中间表 `user_llm_binding`（含 `is_default`）；接口 `GET /llm/models`、`GET /llm/catalog`、`POST/DELETE /llm/bindings`、`PUT /llm/bindings/{v}/{c}/default`。
- 对话路由：`LlmVendorFactory`（DashScope + OpenAiCompat）+ `LlmModelRouter` 按 vendor/modelCode 动态构建模型实例；`POST /chat/message` 同步返回。
- 数据库：MySQL `vc` 库 4 张表已建，种子由 `DataInitializer` 幂等写入；SQL 脚本在 `docs/sql/`。
- AK：配置文件 `application-local.yml`（`llm.vendors.*`），后期迁 Nacos。
- 前端：登录切真实；模型管理页 + 对话页模型下拉（默认模型自动选中、会话内锁定）。

**已知阻塞**：DashScope 免费额度已耗尽（403 FreeTierOnly），需充值或换有效 AK 后才能拿到真实模型回复；DeepSeek AK 待填。

**后续待办**：SSE 流式（Phase 1）、会话/消息持久化、RAG（Phase 2）、迁移 PostgreSQL。
