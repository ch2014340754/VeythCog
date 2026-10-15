# PROJECT_MEMORY · VeythCog 项目记忆文档

> **本文件用途**：给未来的 AI Agent（以及协作者）快速恢复项目心智模型，减少每次迭代重新摸底的成本。
> **维护规则**：每次项目迭代（改架构、加接口、换库、迁移模块）后，由 Agent 在本文件同步更新，并保持与真实代码一致。
> **信息基准**：2026-10-15，依据对仓库源码与配置的实际遍历（非仅凭 README）。

---

## 0. 一句话定位

VeythCog（渡思）——**个人全栈工作台 / 面试作品集**：一处聚合开发工具、代码片段、笔记与 AI 能力的自用门户；以「Java 后端 × LLM 工程化」为面试深水区。Monorepo，OpenSpec（规范驱动开发）工作流。

---

## 1. Monorepo 布局

```
VeythCog/                      # 仓库根（本项目记忆文档所在）
├── PROJECT_MEMORY.md          # ← 本文件
├── agent.md                   # AI Agent 协作开发规范（OpenSpec 流程 / 硬性约束 / 质量门）
├── README.md                  # 仓库总览（部分描述滞后，以本记忆文档为准）
├── openspec/
│   └── changes/p0-fullstack-connect/   # 已完成变更目录（proposal/design/tasks/specs）
├── VeythCog-C/                # 后端：Spring Boot 3.5 + Java 21 + Spring AI（模块化单体）
└── VeythCog-V/                # 前端：React 18 + TS + Vite + AntD 5 + Zustand
```

**端口约定**：后端 `:8123`（context-path `/api`），前端 `:3000`。

---

## 2. 技术栈

| 端 | 技术 | 说明 |
|---|---|---|
| 后端 | Spring Boot 3.5.8 / Java 21 / Maven | 模块化单体，父 pom 管版本（BOM：spring-ai-alibaba 1.1.2.0 / spring-ai 1.1.2） |
| 后端 | Spring AI（ChatClient / ChatMemory / Advisor） | LLM 统一抽象，流式走 `reactor` Flux |
| 后端 | Spring Security + JWT（jjwt 0.12.6）+ BCrypt | 无状态鉴权 |
| 后端 | Spring Data JPA / JDBC | 业务实体 + 记忆仓库 |
| 数据库 | **PostgreSQL（当前 active，本地走 Supabase 云端）** | `ddl-auto=none`，表由 `docs/sql/*.sql` 管理；vc-app 仍残留 MySQL 驱动未清理 |
| 接口文档 | springdoc + knife4j（springdoc 2.8.9 显式锁定） | `/api/doc.html`、`/api/v3/api-docs` |
| 前端 | React 18 / TS / Vite 5 / AntD 5 / Zustand(persist) / React Router 6 | fetch+ReadableStream 封装 SSE |

---

## 3. 后端：模块化单体（核心心智）

### 3.1 模块与依赖方向

```
vc-common(公共基础) ← vc-llm(LLM 网关) ← vc-chat(对话域) / vc-knowledge(知识库域) → vc-app(唯一可运行)
vc-learn(独立学习沙箱，零依赖业务模块，可单独运行)
```

- **依赖方向单向**：`common ← llm ← (chat, knowledge) ← app`；chat 与 knowledge 互相不依赖。
- **仅 `vc-app` 可运行**（端口 8123，`/api`）；其余为纯库（无 boot 插件、无 main）。
- RAG 组合动作规划落在 vc-app 的 `orchestration` 包（当前为空占位）。

### 3.2 各模块职责与关键类

**vc-common**（`com.vc.common`）：`BaseResponse`、`ResultUtils`、`PageRequest`、异常体系（`BusinessException` / `ErrorCode` / `ThrowUtils`）。

**vc-llm**（`com.vc.llm`）—— LLM 调度网关（面试深水区①）：
- `enums/LlmVendor`：**供应商固定枚举**（`dashscope` 阿里百炼 / `deepseek`），不建表。
- `entity/LlmModel`（模型目录）、`entity/UserLlmBinding`（用户-模型绑定中间表）。
- `factory/LlmVendorFactory` + `DashScopeVendorFactory` / `OpenAiCompatVendorFactory`：按供应商创建 `ChatModel`，收敛厂商差异。
- `router/LlmModelRouter`：核心。校验绑定→查模型→`ConcurrentHashMap` 缓存 `ChatClient` 实例（key=`vendor:modelCode`）→ 挂 `MessageChatMemoryAdvisor`（JDBC 记忆）→ 提供**同步 `chat()` 与流式 `stream()`**。
- `config/LlmVendorProps`：AK/baseUrl 配置映射（`llm.vendors.*`）。
- `service/LlmModelService`：绑定查询/目录/绑定/解绑/设默认（应用层保证默认唯一：设默认先清该用户其他默认）。
- `LlmChatService`：对外的对话入口，转发到 `LlmModelRouter`。

**vc-chat**（`com.vc.chat`）—— 对话域（无 Controller）：
- `ChatService`：领域入口，委托 `LlmChatService`，提供同步 `chat()` 与流式 `streamChat()`。
- `memory/ChatMemoryConfig`：把 JDBC 记忆仓库包装成 Spring AI `ChatMemory`，`MessageWindowChatMemory` **窗口 20 条**截断。
- `memory/JdbcChatMessageRepository`：实现 `ChatMemoryRepository`，落 `chat_message` 表（`(conversation_id, seq)` 排序，记忆主键=`userId:conversationId`）。

**vc-app**（`com.vc.app`）—— 唯一可运行，装配全部：
- `auth/*`：JWT 鉴权（`JwtUtil` / `JwtAuthFilter` / `AuthServiceImpl` / `PasswordUtil` / `User`）。
- `web/*`（Controller）：`ChatController`（`/chat/message` 同步 + `/chat/stream` SSE）、`LlmModelController`、`AuthController`、`HealthController`、`KnowledgeController`（骨架）、`GlobalExceptionHandler`。
- `config/*`：`SecurityConfig`（无状态，放行 `/auth/**`、`/health/**`、接口文档、ASYNC 分发）、`CorsConfig`、`DataInitializer`（幂等种子：模型目录 + admin 用户 + 默认绑定 qwen-plus）。
- `admin` / `orchestration`：占位（系统管理后端未实现）。

**vc-knowledge**（`com.vc.knowledge`）—— **仅骨架**（`KnowledgeServiceImpl` 返回空，TODO(Phase 2)）。

**vc-learn**（`com.vc.learn`）—— **Spring AI 学习沙箱**：独立可运行、只连 DashScope、与业务模块零依赖。含 `examples/chat`（`ChatDemo` / `ChatController` / Advisor：`RereadingAdvisor` / `SimpleLoggerAdvisor`）、结构化输出测试（`StructuredOutTest`）等。**git status 有未提交改动**（ChatController 修改 + 新增 service/ 与测试）。

---

## 4. 三大深水区：当前实现状态（以代码为准）

| 深水区 | 架构文档记录 | **代码实际状态（2026-10-15）** |
|---|---|---|
| ① llm-gateway 多模型调度 | Phase 1 | ✅ 已落地：供应商抽象+工厂+路由+实例缓存；DashScope 与 OpenAI 兼容双工厂 |
| ② SSE 流式全链路 | Phase 1 待办 | ✅ **已落地**：`POST /chat/stream`（SseEmitter + Flux 逐 token，`[DONE]` 结尾，客户端断开取消上游）；前端 `api/chat.ts` `streamChatMessage()` |
| ③ 会话/消息持久化 | Phase 1 待办 | ✅ **已落地（记忆层）**：Spring AI `ChatMemory` + `JdbcChatMessageRepository`（`chat_message` 表）；⚠️ 无独立会话表，会话元数据仍在前端本地（Zustand persist） |
| RAG 知识库 | Phase 2 | ⭕ 仅骨架（vc-knowledge + KnowledgeController），未实现 |

> **重要**：`docs/architecture.md` 与 `agent.md` 仍把 SSE 流式/会话持久化列为待办——**文档滞后于代码**。新增迭代前先读代码，别信旧文档。

---

## 5. 数据模型（PostgreSQL 方言，脚本见 `VeythCog-C/docs/sql/`）

| 表 | 说明 | 关键约束 |
|---|---|---|
| `app_user` | 用户 | username unique；password 为 BCrypt |
| `llm_model` | 模型目录（vendor_code 仅存字符串，供应商为枚举不建表） | unique(vendor_code, model_code) |
| `user_llm_binding` | 用户-模型绑定中间表 | unique(user_id, vendor_code, model_code)；is_default 应用层保证每用户至多 1 个 |
| `chat_message` | 对话记忆（Spring AI JDBC 落库） | unique(conversation_id, seq)；conversation_id=`userId:conversationId` |

> `llm_vendor` 表已**下线**（`005_drop_llm_vendor.sql`），改后端枚举。脚本含 MySQL/PG 双语差异注释。

---

## 6. 后端关键接口契约（context-path `/api`）

| 方法 | 路径 | 请求体 | 鉴权 |
|---|---|---|---|
| POST | `/auth/login` | {username, password} | 否 |
| GET | `/llm/models` | - | 是（当前用户绑定启用模型） |
| GET | `/llm/catalog` | - | 是（供应商枚举+模型目录+绑定标记） |
| POST | `/llm/bindings` | {vendor, modelCode, isDefault?} | 是 |
| DELETE | `/llm/bindings/{vendor}/{modelCode}` | - | 是 |
| PUT | `/llm/bindings/{vendor}/{modelCode}/default` | - | 是 |
| POST | `/chat/message` | {message, vendor, modelCode, conversationId?} | 是（同步返回 string） |
| POST | `/chat/stream` | {message, vendor, modelCode, conversationId?} | 是（SSE：`data: <token>`，末尾 `data: [DONE]`，错误 `event:error`） |
| GET/POST | `/knowledge` | - | 是（骨架） |
| GET | `/health` | - | 否 |

统一返回 `BaseResponse<T>`：`{ code, data, message }`，`code===0` 成功；未登录 401（`ErrorCode.NOT_LOGIN_ERROR`）。

---

## 7. 前端架构（VeythCog-V）

### 7.1 三层依赖方向
```
页面组件 → stores/（Zustand 业务状态）→ api/（数据请求）→ mock/ 或 真实后端
                                 ↘ config/（环境变量统一读取层，业务不直接碰 import.meta.env）
                                 ↘ utils/storage.ts（localStorage 封装，命名空间+TTL）
```

### 7.2 核心封装
- `api/client.ts`：`http`（fetch 封装：baseURL / 自动带 token / 401 跳登录 / 超时 / 统一错误）。
- `api/sse.ts`：通用 `streamChat()`（OpenAI 兼容 /chat/completions，原生 EventSource 不能带 header 故用 fetch 手动解析）。
- `api/chat.ts`：`sendMessage()` 同步 + `streamChatMessage()` 流式（`/chat/stream`，支持 AbortController 中断）。
- `api/auth.ts` / `llm.ts`：已接真后端；`knowledge.ts` / `admin.ts`：仍 mock。

### 7.3 Zustand stores（6+1，全部 persist）
`authStore`(token/用户/飞书) · `settingsStore`(模型绑定列表+当前模型+流式开关+毛玻璃) · `chatStore`(会话列表/流式增量) · `knowledgeStore` · `dbStore` · `toolTabsStore`。

> 注意：`settingsStore.providers`（本地供应商 CRUD）已演进为**从后端拉取绑定模型**（P0 改造），`doc/README.md` 该节描述偏旧。

### 7.4 会话模型绑定策略（生产策略，已实现）
新建会话可选模型并写入 `Conversation.vendor/modelCode/modelName`；进入已有会话后**下拉禁用**（会话内禁切）。无绑定→空态引导去模型配置页。

### 7.5 其他已落地
- 主题系统：6 预设 × 亮暗 + **全局毛玻璃开关**（CSS 变量 + inline style 双轨）。
- 浮动音乐播放器（`FloatingMusicPlayer`，真 `<audio>`，mock 歌单）。
- 可折叠侧栏（`CollapsibleSidebar`，物理裁剪把手，persist）。
- 工具集：24+ 工具（`registry.tsx` 注册表，React.lazy 独立分包，多标签保留状态）。
- Admin 后台：`/admin/*` 全 mock，按用户名 `admin` 推断 role（真实 role 字段后端未下发）。

---

## 8. 配置与启动

### 8.1 后端
- 配置文件：`vc-app/src/main/resources/application.yml`（通用）+ `application-local.yml`（**本地环境，已被 .gitignore 忽略，不入库**）。
- **当前 active：PostgreSQL（Supabase 云端连接串在 application-local.yml）**；`docs/architecture.md` 记的"MySQL 先行"已过时。
- **安全红线**：`application-local.yml` 含**真实 DashScope AK 与数据库密码，严禁写入任何文档/提交 Git**；密钥一律环境变量注入（`DASHSCOPE_API_KEY` / `DEEPSEEK_API_KEY` / `JWT_SECRET` / DB 密码）。
- AK 未配置时：可绑定但对话报「该模型未配置密钥」（`ErrorCode.SYSTEM_ERROR`）。
- 启动：`mvn -pl vc-app -am spring-boot:run`（或 `-pl vc-chat -am` 编译）。
- 种子账号：`admin / admin123`，默认绑定 `dashscope/qwen-plus`。

### 8.2 前端
- `.env.local`（不提交）：`VITE_API_BASE=http://localhost:8123/api`、`VITE_USE_MOCK=false`；`src/config/index.ts` 兜底默认 8123。
- 启动：`npm install && npm run dev`（:3000）；构建：`npm run build`（tsc + vite）。

### 8.3 数据库
- `docker-compose.yml`：`pgvector/pgvector:pg16`（本地单库两用备选，当前实际用 Supabase 云端）。
- `ddl-auto=none`：新表需手动执行 `docs/sql/*.sql`（`chat_message` 建表后记忆才生效）。

---

## 9. OpenSpec 开发流程（`agent.md` 为权威）

核心循环：**propose → review → apply → archive**。
- 非琐碎变更：先在 `openspec/changes/<feature>/` 写 `proposal.md` / `specs/*.md`（行为+验收）/ `design.md`（接口契约）/ `tasks.md`（原子任务）。
- **必须人工 review 确认后才 apply**；apply 严格按 design 的目录结构/接口签名/schema；完成后把 specs delta 合并回长期文档并归档。
- 硬性约束：契约先行、前后端解耦；API Key 不落前端；端口 8123/3000；前端不感知厂商差异（收敛后端网关）；会话模型绑定；防烂尾（每阶段≤3 周）。
- 质量门：编译通过 + 真实运行验证核心链路（登录→查模型→发消息→收回复）+ 数据可复核 + 状态单一权威 + 缺口披露。

---

## 10. 当前状态快照与待办

**已打通（可演示）**：真 JWT 登录 → 模型绑定管理 → 同步对话 + **SSE 流式对话**（带 JDBC 会话记忆、可中断）。

**已知阻塞**：
- DashScope 免费额度曾耗尽（403 FreeTierOnly），需充值或换有效 AK 才能拿真实回复；DeepSeek AK 待填。

**待办/演进**（源自架构文档 + 现状）：
1. 会话元数据持久化（现仅记忆层落库，会话列表在前端本地）。
2. RAG 知识库实现（vc-knowledge 骨架 → 分块/Embedding/pgvector/带引用回答）。
3. Admin 后台后端对接（现全 mock，`api/admin.ts`）。
4. 真实 `role` 字段由后端 `/auth/me` 下发。
5. vc-app 清理残留 MySQL 驱动与过时注释。
6. vc-learn 未提交改动整理（结构化输出实验）。
7. 同步各文档滞后点（见 §4 / §7.3 / §8.1）。

---

## 11. 迭代维护规则（给未来 Agent）

每次在本仓库做变更（结构/接口/库/模块/配置/流程）后，**必须在 `PROJECT_MEMORY.md` 同步**：
1. 更新受影响章节（§3 模块、§4 状态矩阵、§5 表结构、§6 接口、§8 配置）。
2. 保持「记忆文档 = 代码现状」，若与 `docs/architecture.md` / `doc/README.md` 冲突，以**代码与本文档**为准，并顺手修订旧文档或标注滞后。
3. 把「信息基准」日期更新为当天。
4. **绝不写入真实密钥 / 数据库密码 / 个人敏感信息**。

---

## 12. 安全约束（重申）

- 真实 AK（DashScope/DeepSeek）与数据库凭证只存 `application-local.yml`（已 gitignore），不得出现在任何提交文件或本记忆文档。
- 前端任何层不得落 API Key；密钥只存后端并加密。
- 本记忆文档不含任何密钥、口令、令牌。
