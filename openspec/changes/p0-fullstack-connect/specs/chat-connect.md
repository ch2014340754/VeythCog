# Spec · 对话路由（chat-connect）

## 行为契约

### 能力：按 vendor/modelCode 路由的同步对话

- 请求 `POST /api/chat/message`（受保护，需 JWT）
- 请求体：`{ "message": string, "vendor": string, "modelCode": string }`
- 处理链路：**统一 Controller 单入口** → 校验当前用户已绑定该模型 →
  按 `vendor + modelCode` 查找模型配置（MySQL `llm_model`）→
  从缓存获取/懒创建模型实例（工厂，AK 来自配置文件）→ 调用 → 返回完整文本。
- 成功返回 `{ code: 0, data: "模型回复文本", message: "ok" }`（同步，非流式）。

### 能力：模型实例工厂与缓存

- `LlmVendorFactory`：接口 + 多实现（DashScope / OpenAI 兼容），收敛厂商 SDK 差异；
  每个实例独立绑定 AK 与 baseUrl，避免串号。
- 实例按 `vendor:modelCode` 缓存，懒加载；AK 变更后提供缓存刷新（本轮仅预留方法）。

### 能力：AK 读取（配置文件）

- `application-local.yml`（本地，已 gitignore）按 vendor 配置：
  - `llm.vendors.dashscope.api-key`（用户填写，后期 Nacos）
  - `llm.vendors.deepseek.api-key` / `base-url`
- 未配置 AK 的 vendor → 发起对话时返回「该模型未配置密钥」错误（50000），不影响列表展示。

### 能力：错误兜底

- 模型不存在 / 未启用 / 用户未绑定 → `{ code: 40000, message: "模型不可用" }`（统一提示，不暴露细节）。
- AK 未配置 → `{ code: 50000, message: "该模型未配置密钥" }`。
- 上游调用异常/超时 → 50000，message 统一说明（前端不区分厂商）。

## 验收标准

- [ ] 有效 JWT + 用户已绑定的合法 `vendor/modelCode` → 返回真实模型回复文本。
- [ ] 同一 `vendor:modelCode` 连续调用复用实例（命中缓存）。
- [ ] 用户未绑定的模型 → 40000，不调用模型。
- [ ] 不存在的 vendor/modelCode → 40000。
- [ ] 未配置 AK 的 vendor → 50000 且 message 明确。
- [ ] 会话绑定逻辑在前端完成（新建选模型、会话内禁切）；后端无状态、不感知会话。
- [ ] 前端模型选择行为：
  - `GET /api/llm/models` 为空 → 下拉空态，提示「尚未绑定模型，请到模型配置页选择厂商绑定」，提供跳转入口。
  - 非空 → 自动选中 `isDefault=true` 的模型（无默认则选第一个）。

## 边界与异常
- `message` 为空 → 40000。
- 本轮同步返回；SSE 流式、中断、token 统计在下一轮 spec 定义。
- 前端本地会话（Zustand persist）本轮不落后端；对话接口无需 conversationId。
