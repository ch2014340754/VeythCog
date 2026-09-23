# Spec · 模型管理（model-management）

## 领域模型

- **供应商 = 系统枚举**（非用户自定义）：`deepseek`（DeepSeek）、`dashscope`（阿里百炼）。
  - 表 `llm_vendor`：`vendor_code(PK), vendor_name, base_url, enabled, create_time`。
- **模型 = 供应商下的目录**：表 `llm_model`：`id, vendor_code, model_code, model_name, max_context_tokens, temperature, enabled, create_time`，
  唯一约束 `(vendor_code, model_code)`。
- **用户-模型绑定 = 中间表**：表 `user_llm_binding`：`id, user_id, vendor_code, model_code, is_default, enabled, create_time`，
  唯一约束 `(user_id, vendor_code, model_code)`。一个用户可绑定多个（跨供应商）模型用于切换。
- **默认模型**：`is_default=1` 表示该用户的默认模型（每用户至多 1 个，应用层保证，不依赖 DB 唯一约束）。

## 行为契约

### 能力：查询我的绑定模型（对话页下拉）

- 请求 `GET /api/llm/models`（受保护，需 JWT）→ 返回**当前登录用户**绑定的启用模型。
- 成功返回 `{ code: 0, data: [ { vendor, modelCode, modelName, enabled, isDefault }, ... ], message: "ok" }`
- 不含密钥；按绑定创建时间排序；`isDefault` 用于前端自动选中默认模型。
- 列表为空 → `data: []`（前端据此展示"去配置绑定模型"引导）。

### 能力：查询模型目录（管理页）

- 请求 `GET /api/llm/catalog`（受保护）→ 返回供应商枚举 + 其下模型 + 当前用户是否已绑定。
- 返回 `{ code: 0, data: [ { vendor, vendorName, baseUrl, models: [ { modelCode, modelName, bound: boolean, enabled } ] } ], message: "ok" }`

### 能力：绑定 / 解绑模型

- `POST /api/llm/bindings`，body `{ "vendor": string, "modelCode": string, "isDefault"?: boolean }` → 为当前用户添加绑定。
  - 成功：`{ code: 0, data: true }`；重复绑定 → 幂等返回 true（不报错）。
  - `isDefault=true` 时，同时将该模型设为当前用户的默认模型（清掉其他默认）。
- `DELETE /api/llm/bindings/{vendor}/{modelCode}` → 移除当前用户的绑定。不存在 → 40000「绑定不存在」。
  - 若被删的是默认模型：删除后该用户无默认模型（前端回落选第一个）。

### 能力：设置默认模型

- `PUT /api/llm/bindings/{vendor}/{modelCode}/default` → 把当前用户已绑定的模型设为默认。
  - 成功：`{ code: 0, data: true }`，且清除该用户其他绑定的 `is_default`。
  - 未绑定该模型 → 40000「未绑定该模型」。

## 验收标准

- [ ] 登录后 `GET /api/llm/models` 只返回**当前用户**绑定的启用模型。
- [ ] `GET /api/llm/catalog` 返回 deepseek / dashscope 两个供应商及各自模型目录。
- [ ] `POST /api/llm/bindings` 绑定成功后，`GET /api/llm/models` 能查到；catalog 中 `bound=true`。
- [ ] 重复绑定幂等（不报错）。
- [ ] `DELETE /api/llm/bindings/{vendor}/{modelCode}` 后列表不再包含；再删 → 40000。
- [ ] `PUT /api/llm/bindings/{vendor}/{modelCode}/default` 后，`GET /api/llm/models` 中仅该模型 `isDefault=true`。
- [ ] 设置某模型为默认后，该用户其他绑定 `isDefault` 均被清除。
- [ ] 解绑默认模型后，该用户无 `isDefault=true` 的绑定。
- [ ] 所有响应不含 apiKey。
- [ ] 种子数据：admin 用户绑定 dashscope/qwen-plus 且 `is_default=1`，登录即可演示默认自动选中。

## 边界与异常
- 绑定不存在的 vendor/modelCode → 40000「模型不存在」。
- 无 token → 40100。
- 模型 `enabled=false` 不允许绑定（40000）；已绑定的禁用模型在 models 列表不返回。
