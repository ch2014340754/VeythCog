# 规格：模型目录管理（管理端）

## 能力 1：查询目录

- `GET /admin/llm-models`，仅 `ADMIN`。
- 返回全部模型（含未上架）：`id / vendor / vendorName / modelCode / modelName / maxContextTokens / temperature / enabled / bindingCount`。
- 按 `vendorCode, id` 升序。

## 能力 2：新增模型

- `POST /admin/llm-models`，body：`{vendor, modelCode, modelName?, maxContextTokens?, temperature?, enabled?}`。
- `vendor` 必须是后端枚举值（`dashscope` / `deepseek`），否则 40000。
- `(vendor, modelCode)` 已存在 → 40000「该供应商下已存在模型 X」。
- 缺省：`modelName = modelCode`，`maxContextTokens = 32768`，`temperature = 0.70`，`enabled = true`。
- 校验：`modelCode ≤ 64` 字符；`maxContextTokens ∈ [1024, 2000000]`；`temperature ∈ [0, 2]`。

## 能力 3：编辑模型

- `PUT /admin/llm-models/{id}`，body 同新增。
- 模型不存在 → 40400。
- 若修改了 `vendor` 或 `modelCode` 且该模型已有用户绑定 → 40000「该模型已被 N 位用户绑定，不能修改供应商或模型编码」。
- `modelName` 为空时保留原值；其余字段按入参覆盖。

## 能力 4：删除模型

- `DELETE /admin/llm-models/{id}`。
- 仍有用户绑定 → 40000「该模型仍有 N 条用户绑定，请先下架并让用户解绑后再删除」。
- 无绑定 → 物理删除，返回 `true`。

## 能力 5：上下架

- `PUT /admin/llm-models/{id}/enabled`，body `{enabled}`。
- 下架后用户侧 `GET /llm/catalog` 不再返回该模型，`POST /llm/bindings*` 对该模型返回 40000「模型不存在/未启用」；已存在的绑定行不自动删除（恢复上架即可继续用）。

## 能力 6：从供应商同步

- `POST /admin/llm-models/sync`，body `{vendor, enableNew?}`。
- 鉴权：Bearer AK，取以下顺序：服务端 `llm.vendors.{vendor}.api-key` → 当前管理员的用户自持 AK（解密）→ 均无则 40000 明确提示。
- 百炼：分页拉取 `https://dashscope.aliyuncs.com/api/v1/models`（`page_size=100`，最多 10 页），只保留 `capabilities` 含 `TG` 的模型；名称取 `name`（截断 64 字符）。
- DeepSeek / 其他 OpenAI 兼容：`{base-url}/models`，取 `data[].id`。
- 写入语义：只补齐缺失项；已存在的跳过（无论是否上架）；**不删除、不覆盖**已有 `modelName` / `maxContextTokens` / `temperature` / `enabled`。
- 新增项 `enabled = enableNew`（默认 false）；`maxContextTokens=32768`、`temperature=0.70`。
- 返回：`{vendor, vendorName, total, added, skipped, addedCodes[], message}`。
- 上游 401/403 → 40000「鉴权失败，请检查 API Key」；其他非 2xx → 40000 附状态码与响应片段；网络异常 → 50000。

## 验收标准

- 新增/编辑/删除/上下架均落库，管理列表与用户目录同步变化；
- 有绑定的模型无法删除、无法改编码/供应商；
- 同步后 `llm_model` 行数增加，重复同步 `added=0`；
- 所有管理接口非 `ADMIN` 访问返回 403，未登录 401；
- 页面操作后静默刷新，不清空当前表格。
