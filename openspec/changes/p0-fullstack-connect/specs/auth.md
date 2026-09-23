# Spec · 认证（auth）

## 行为契约

### 能力：登录并签发 JWT

- 请求 `POST /api/auth/login`
- 请求体：`{ "username": string, "password": string }`
- 数据源：MySQL `app_user` 表（库 `vc`，JPA 实体映射）
  - 字段：`id, username(唯一), password(BCrypt 密文), nickname, email, create_time`
  - 密码以 BCrypt 密文入库；校验用 BCrypt `matches`，不比较明文。
- 成功（username 存在 且 密码匹配）：
  - 返回 `{ code: 0, data: { token, username, nickname }, message: "ok" }`
  - `token` 为真实 JWT（jjwt 签发），有效期默认 24h，HS256。
- 失败：username 不存在 或 密码不匹配 → `{ code: 40000, data: null, message: "用户名或密码错误" }`。

### 能力：受保护接口鉴权

- `POST /api/chat/message`、`GET /api/llm/models`、`GET /api/llm/catalog`、
  `POST/DELETE /api/llm/bindings` 均为受保护接口（需 `Authorization: Bearer <token>`）。
- 未带 token 或 token 无效/过期 → `{ code: 40100, data: null, message: "未登录" }`，HTTP 状态 401。
- 前端 `client.ts` 收到 401 时清理 token 并跳 `/login`，后端保证返回语义正确即可。

## 验收标准

- [ ] 用种子数据中的账号+正确密码登录，返回的 JWT 可被后端自校验。
- [ ] 错误密码 / 不存在账号 → 40000 且不签发 token。
- [ ] 携带有效 token 访问受保护接口返回 200。
- [ ] 不带 token 访问受保护接口 → 40100，不执行业务逻辑。
- [ ] `/api/auth/login` 本身放行（无需 token）。
- [ ] 用户数据来自 MySQL `app_user` 表；建表脚本见 `docs/sql/002_app_user.sql`。

## 边界与异常
- 用户名/密码为空 → 40000（@Valid 校验）。
- token 过期/被篡改 → 40100。
- 本轮不做 refresh token；不做 `/auth/me`（前端已有本地 user 缓存）。
- 表名 `app_user`：避开 `user` 保留字（MySQL 与 PG 通用），实体类仍可叫 `User`。
