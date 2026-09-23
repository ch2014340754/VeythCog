# Proposal · P0 前后端串联（多模型对话同步闭环）

> v2：根据用户确认更新——数据库用本机 MySQL（保留迁 PG 脚本）；模型管理改为
> 「供应商枚举 + 用户-模型绑定中间表」；AK 走配置文件（后期 Nacos）。

## 为什么做（Why）

当前前端对话完全走 mock，模型管理停留在浏览器 localStorage，
后端仅有单模型同步骨架、无真 JWT、无模型接口。P0 目标是打通一条**可演示的同步全链路**：
登录 → 查询当前用户绑定的模型 → 选择模型创建会话 → 发消息 → 后端按模型路由 → 返回回复。

## 做什么（What）

- 数据库（本机 MySQL）：
  - 新建数据库 `vc`（`jdbc:mysql://localhost:3306/vc`，root/123456）。
  - 建表：`app_user`（用户）、`llm_vendor`（供应商枚举）、`llm_model`（模型目录）、`user_llm_binding`（用户-模型绑定中间表）。
  - 保留 SQL 脚本到 `docs/sql/`，作为后续迁 PostgreSQL 的基线（脚本内注明迁移差异）。
- 后端 `vc-chat`：
  - 认证：Spring Security + jjwt，`POST /api/auth/login` 基于 MySQL `app_user` 表校验并签发**真实 JWT**。
  - 模型管理：供应商为**系统枚举**（deepseek / dashscope 阿里百炼），用户通过**中间表**绑定自己选填的模型；
    `GET /api/llm/models` 返回**当前登录用户绑定的启用模型**（用于切换下拉）。
  - 模型绑定管理：新增绑定 / 移除绑定 / 模型目录查询（“管理模型”能力）。
  - 对话：`POST /api/chat/message`（**同步**），body 携带 `vendor + modelCode + message`，
    通用 controller 按 vendor/modelCode 路由到对应模型实例。
  - AK：**配置文件管理**（`application-local.yml` 按 vendor 配置，用户填写；后期 Nacos 接管），不落库、不落前端。
- 前端 `VeythCog-V`：
  - 登录切真实接口；模型列表从后端拉取（替代 localStorage 管理）；
  - 对话页模型下拉：新建会话可选、进入会话后禁用；发消息走真实同步接口；
  - 模型管理页：展示供应商枚举 + 我的绑定模型（增/删绑定）。

## 范围

### In-scope（本轮交付）
1. MySQL 建库 `vc` + 4 张表 + 种子数据（供应商枚举、模型目录、初始用户）。
2. SQL 脚本保留（`docs/sql/`，MySQL 版 + 迁 PG 注意事项）。
3. 后端真实 JWT 登录 + 鉴权过滤（数据源 MySQL）。
4. 模型接口：`GET /api/llm/models`（我的绑定）、`GET /api/llm/catalog`（模型目录）、
   `POST/DELETE /api/llm/bindings`（绑定/解绑）。
5. 后端 `POST /api/chat/message` 同步对话 + 按 vendor/modelCode 路由（通用 controller + 工厂 + 实例缓存）。
6. 前端登录、模型管理页、模型选择器（会话绑定/会话内禁切）、对话切真实接口；`.env.local` 对齐 8123。

### Out-of-scope（本轮不做，明确延后）
- ❌ SSE 流式 / 中断生成（下一轮单独立项）。
- ❌ 会话/消息持久化到后端（前端本地 Zustand persist，对话接口不带 conversationId）。
- ❌ AK 加密存储 / Nacos 接入（本轮配置文件明文占位，由用户填写）。
- ❌ 注册接口（`/auth/register` 保留原语义，不建新表逻辑）。
- ❌ RAG / 知识库引用（仅写文档，不做实现）。
- ❌ 数据库迁移到 PostgreSQL（仅保留脚本）。

## 影响面
- 后端：`vc-chat` 新增 security/jjwt/jpa/mysql 依赖、模型与绑定接口、模型路由工厂；`vc-core` 不变。
- 前端：`api/auth.ts`、`api/chat.ts`、新增 `api/llm.ts`、`types`、`settingsStore`、`Chat/index.tsx`、`Settings/Providers.tsx`、`.env.local`。
- 无破坏性改动：本地会话数据仍可用；`settingsStore.providers` 收敛为「后端绑定模型列表 + 当前选中」。

## 验收总则（每项可演示）
启动前后端：登录拿真 JWT → 模型管理页能看到供应商枚举并绑定/解绑模型 → 对话页下拉显示我的绑定模型 →
新建会话可选模型 → 发消息收到真实模型回复 → 切换会话下拉禁用。
