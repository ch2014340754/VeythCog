# AI 协作全局规则（global-rule.md）

> 用途：给所有协作 Agent 的统一编码规范、命名规约、错误处理与返回体格式。与 `PROJECT_MEMORY.md` 互补：本文件是「怎么做」，PROJECT_MEMORY 是「现状是什么」。
> 冲突处理：若与代码现状冲突，以代码为准，并回写本文件或 PROJECT_MEMORY。

## 1. 技术栈与模块

| 端 | 技术 | 端口/说明 |
|---|---|---|
| 后端 | Spring Boot 3.5.8 / Java 21 / Maven / Spring AI 1.1.2 | `:8123`，context-path `/api` |
| 前端 | React 18 / TS / Vite / AntD 5 / Zustand | `:3000` |
| 数据库 | PostgreSQL 16 + pgvector | `ddl-auto=none`，表由 `docs/sql/*.sql` 脚本管理 |

模块依赖方向（单向）：`vc-common ← vc-llm ← (vc-chat, vc-knowledge) ← vc-app`；`vc-learn` 独立沙箱。
仅 `vc-app` 可运行（有 main），其余为纯库。**chat 与 knowledge 互不依赖**。

## 2. 命名与包结构规约

- 包前缀统一 `com.vc.*`：`com.vc.common`（公共）、`com.vc.llm`（LLM 网关）、`com.vc.chat`（对话域）、`com.vc.knowledge`（知识库域）、`com.vc.app`（装配/Controller/auth）。
- 分层命名：`XxxController` / `XxxService`（接口）+ `XxxServiceImpl`（实现）/ `XxxRepository` / `entity/Xxx` / `dto/XxxRequest|XxxResponse`。
- 枚举放 `enums/`，供应商/工厂放 `factory/`，路由放 `router/`。
- 前端：`api/*.ts`（数据来源）、`stores/*.ts`（Zustand）、`types/index.ts`（TS 类型契约）、`pages/*`（页面）、`components/*`（通用组件）、`mock/*`（mock 数据）。
- 前后端字段命名：后端 Java 用 camelCase，JSON 序列化后与前端 TS 字段对齐（如 `libType`/`isVectorized`/`updatedAt`）。

## 3. 统一返回体格式（硬性）

所有 Controller 返回 `BaseResponse<T>`，JSON 结构：

```json
{ "code": 0, "data": {}, "message": "ok" }
```

- 字段名是 **`message`**（不是 `msg`）；成功 `code=0`、`message="ok"`。
- 成功用 `ResultUtils.success(data)`；失败用 `ResultUtils.error(...)` 或抛 `BusinessException` 交给 `GlobalExceptionHandler`。
- 分页统一用 `PageRequest`：`{ current=1, pageSize=10, sortField, sortOrder="descend" }`；列表返回 `{ records, total, current, pageSize }`。
- 时间字段后端返回 epoch 毫秒（`number`），前端 `formatRelativeTime` 渲染，禁止返回格式化字符串。

## 4. 错误处理规范

- 错误码统一用 `com.vc.common.exception.ErrorCode` 枚举，**新增业务错误码须在此枚举追加**，不散落魔法数字。
- 现有错误码：`0` 成功 / `40000` 参数错误 / `40100` 未登录 / `40101` 无权限 / `40300` 禁止访问 / `40400` 不存在 / `50000` 系统异常 / `50001` 操作失败。
- 校验用 `ThrowUtils.throwIf(condition, errorCode, message)` 抛 `BusinessException`，**禁止在 Service 里手写 try/catch 返回错误结构**（除非要吞掉非致命异常）。
- 权限校验在后端完成，前端仅做 UI 隐藏，不信任前端判断。

## 5. 数据库规范

- `ddl-auto=none`：**新增/修改表必须写 `docs/sql/*.sql` 脚本**，并在 PROJECT_MEMORY 同步表结构。
- 表名/列名 snake_case；主键 `BIGSERIAL`；时间 `TIMESTAMPTZ DEFAULT now()`；软删除用 `deleted BOOLEAN DEFAULT false`。
- 软删除与 `ON DELETE CASCADE` 语义：软删除不触发 FK 级联，关联数据（如 embedding）由接口在事务内显式清理。
- 向量列维度必须与 `spring.ai.dashscope.embedding.options.dimensions` 严格一致（当前 1024），换模型需迁移。
- 中文文本检索用 `to_tsvector('simple', ...)`，不要用 `english`。

## 6. 安全红线

- API Key / 数据库密码 / JWT_SECRET **只存后端 `application-local.yml`（已 gitignore）或环境变量**，严禁写入任何提交文件、文档、前端代码/环境变量。
- 前端任何层不得落 API Key；密钥只存后端。
- 不主动执行 git 写操作（commit/push/pull/merge/rebase/reset/checkout/stash/add），只读 `git log/show/diff/blame/status` 等。

## 7. 编码与文档

- 统一 UTF-8；PowerShell 读文件显式 `-Encoding UTF8`，写文件用 `[System.IO.File]::WriteAllText(path, content, (New-Object System.Text.UTF8Encoding($false)))`（无 BOM）。
- 文档产出遵循：H1 标题 + 元信息块 + 变更记录表 + 变更标识（🆕/✏️/⚠️）+ 表格承载字段/接口 + `file_path:line_number` 反引号引用。
- 按设计文档落地代码前必须走 OpenSpec（propose → review → apply → archive），审批通过后才编码。

## 8. 前端契约切换

- 契约先行：前端先 mock，后端按 `openspec/api-spec.md` 实现后切换；切换时 `api/*.ts` 只替换数据来源，不改变调用方式。
- `ApiResponse<T> = { code, data, message }` 与后端 `BaseResponse` 对齐。
- 前端不感知厂商差异（不写死厂商/模型列表），差异收敛在后端网关/工厂层。