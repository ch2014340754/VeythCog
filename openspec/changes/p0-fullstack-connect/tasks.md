# Tasks · P0 前后端串联（v2）

> 按 design.md 实施。每项完成并验证后再进入下一项。

## 数据库（本机 MySQL）

- [x] **T0** 连接 MySQL（root/123456），创建数据库 `vc`（utf8mb4）。
- [x] **T1** 编写 `docs/sql/001_llm_vendor.sql`、`docs/sql/002_llm_model.sql`、
  `docs/sql/003_user_llm_binding.sql`、`docs/sql/004_app_user.sql`（MySQL 版 + 迁 PG 注意事项头部注释）。
- [x] **T2** 在 MySQL 执行脚本建表。种子数据（供应商/模型/admin/默认绑定）由后端 `DataInitializer`
  启动时幂等写入（不在 SQL 脚本内）。

## 后端（vc-chat）

- [x] **T3** pom 引入 security / jjwt / jpa / mysql-connector-j；application.yml 配 datasource、JPA(none)、llm.vendors AK、jwt.secret。
- [x] **T4** `JwtUtil` + `JwtAuthFilter` + `SecurityConfig`（放行 /auth/**、/health/**、/error，其余 authenticated）。注意：主类已改 `@SpringBootApplication(scanBasePackages="com.vc")`，否则 vc-code 的 GlobalExceptionHandler 不会被扫描、异常会转发 /error 被 Security 拦成 401。
- [x] **T5** `User` JPA 实体 + `UserRepository`；改造 `AuthServiceImpl`：查库 + BCrypt 校验 + 签 JWT。
- [x] **T6** `LlmVendor` / `LlmModel` / `UserLlmBinding` 实体 + 三个 Repository。
- [x] **T7** `LlmModelService` + `LlmModelController`：models / catalog / bindings(POST/DELETE) / bindings/{vendor}/{modelCode}/default(PUT，设默认时清其他默认)。
- [x] **T8** `LlmVendorFactory` 接口 + DashScope / OpenAiCompat 实现 + `LlmModelRouter`（校验绑定→配置→缓存实例→调用）。
- [x] **T9** 改造 `LlmChatService` + `ChatController`：同步 `POST /chat/message`。
- [x] **T10** 后端验证：编译通过；启动（Tomcat 8123，context-path /api）后 curl 实测：
  - `POST /api/auth/login` {admin/admin123} → code=0，真 JWT；
  - `GET /api/llm/models`（带 JWT）→ dashscope/qwen-plus isDefault=true；
  - `GET /api/llm/catalog` → dashscope/deepseek 枚举 + 目录（bound/isDefault 标注）；
  - 无 token → code=40100；
  - `POST /api/chat/message` → 链路通到 DashScope 真实调用，因 AK 免费额度耗尽返回 403，经 LlmModelRouter catch 后透出「模型调用失败：HTTP 403 - Free quota exhausted…」统一业务码 50000（非 401）。
  - ⚠️ 待用户处理：DashScope AK 免费额度已耗尽（需充值/换有效 AK），否则对话拿不到模型回复。

## 前端（VeythCog-V）

- [x] **T11** `.env.local`（8123/api、mock=false）；`config` 默认 apiBase 8123、useMock 默认 false。
- [x] **T12** `types`：Conversation 增 vendor/modelCode/modelName；新增 LlmModelItem / CatalogVendorItem / CatalogModelItem / ApiResponse。
- [x] **T13** `api`：client 增加统一 `{code,data,message}` 解包（code!==0 抛 ApiError）；auth.ts 切真实 `POST /auth/login`；新增 llm.ts（models/catalog/bindings/delete/default）；chat.ts 的 sendMessage 切真实 `POST /chat/message`。
- [x] **T14** `settingsStore`：改为「我的绑定 models[] + currentModelId(vendor:modelCode)」；loadModels 自动选 isDefault；v2 迁移丢弃旧 providers。
- [x] **T15** `chatStore`：会话绑定模型字段（types 已加；Chat 页本地 state 承载绑定逻辑）。
- [x] **T16** `Chat/index.tsx`：模型下拉（无绑定空态引导去配置；有绑定自动选默认；新建可选/发送后锁定禁用；发送携带 vendor/modelCode；重新生成同模型）。
- [x] **T17** `Settings/Providers.tsx`：重写为模型管理页（拉 /llm/catalog 目录 → 绑定勾选 / 解绑 / 设为默认，同步刷新 settingsStore）。
- [x] **T18** 前端验证：`npm run build`（tsc + vite）通过；dev server 启动（3001），后端 8123 连通、登录拿真 JWT。浏览器 GUI 完整流程待用户人工确认。

## 联调收尾

- [~] **T19** 前后端已同时启动（前端 dev 3001，后端 8123），接口级联调全部通过；
  已更新 `VeythCog-V/doc/TODO.md` 与 `VeythCog-C/docs/architecture.md`（P0 落地记录）。
  **待用户**：① 浏览器打开 http://localhost:3001 人工走通 登录→模型绑定→新建会话→发消息；
  ② DashScope 免费额度已耗尽（403），需充值/换有效 AK 或填 DeepSeek AK 后才能拿到真实模型回复；
  ③ GUI 验收通过后再执行 OpenSpec archive。
