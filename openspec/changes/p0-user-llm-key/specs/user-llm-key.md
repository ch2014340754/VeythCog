# Spec · 用户自持加密 Key（user-llm-key）

## 领域模型

- `user_llm_binding` 新增：
  - `api_key_cipher TEXT NULL` —— AES-256-GCM 密文，格式 `base64(iv):base64(ciphertext)`，12 字节随机 IV；
  - `api_key_updated_at TIMESTAMP NULL` —— 最近一次写入 Key 的时间。
- **AK 语义为「用户 + 供应商」级**：同一用户、同一 vendor 下的所有绑定行共享同一份密文；
  新增/变更 Key 时同步更新该 vendor 全部绑定行，避免同一账号多把 Key 造成计费混乱。
- **兜底顺序**：当前用户该 vendor 的 `api_key_cipher`（解密成功）→ 配置文件 `llm.vendors.<vendor>.api-key`。
  两者都缺失 → `50000 该模型未配置密钥`。

## 行为契约

### 能力：批量绑定（供应商 → 多选模型）
- `POST /api/llm/bindings/batch`（需 JWT）
- 请求 `{ "vendor": string, "modelCodes": string[], "apiKey"?: string, "defaultModelCode"?: string }`
- 规则：
  - `vendor` 必须是系统枚举；`modelCodes` 去重后逐个校验存在且 `enabled=true`，否则 40000「模型不存在」/「模型未启用」。
  - `modelCodes` 为空数组 → 解绑该供应商下全部模型（等价于清空该供应商选择）。
  - `apiKey` 非空 → 加密后写入该用户该 vendor 的**所有**绑定行（含本次新增行）；`apiKey` 为空/缺省 → 保留原密文。
  - 本次未选中的同 vendor 旧绑定 → 删除。
  - `defaultModelCode` 命中本次选中集合 → 设为默认（先清空该用户全部默认，再置位）；
    未传 → 若原默认被移除，则默认落到本次选中的第一个；全不选则无默认。
  - 返回 `{ vendor, modelCodes, apiKeyMasked, hasApiKey }`。
- 校验失败（vendor 不在枚举 / 模型未启用 / 模型不属于该 vendor）→ 40000，且不产生任何写入（事务）。

### 能力：单独编辑 / 清除用户 AK
- `PUT /api/llm/vendors/{vendor}/api-key`，body `{ "apiKey": string }`（非空）→ 加密并更新该 vendor 下全部绑定行；
  无任何绑定 → 40000「请先绑定该供应商下的模型」。
- `DELETE /api/llm/vendors/{vendor}/api-key` → 清空该 vendor 下全部绑定的 AK，回到配置兜底。
- 响应 `{ hasApiKey, apiKeyMasked, hasFallbackKey }`。

### 能力：目录展示 Key 状态
- `GET /api/llm/catalog` 每个供应商增补：
  - `hasApiKey`：当前用户是否已存用户 AK；
  - `apiKeyMasked`：脱敏值（例 `sk-a****9f2c`；长度 < 8 时 `s***c`）；
  - `hasFallbackKey`：配置文件是否配置了该 vendor 的 AK（只返回布尔，不回传值）。
- **任何响应不得包含明文 Key**。

### 能力：路由取 Key 与缓存隔离
- `LlmModelRouter.chat / stream / streamStateless`：
  1. 校验绑定存在、启用、模型存在且启用（不变）；
  2. 取 Key：解密用户密文（失败 → 50000「密钥解密失败，请重新配置 API Key」）；无用户 Key → 配置 AK；
  3. 均无 → 50000「该模型未配置密钥」；
  4. ChatClient 缓存键 = `userId:vendor:modelCode:sha256(key)前8位`，用户 Key 变更后自然 miss，
     旧实例不串号；`statelessCache` 同样处理。
- DashScope 必须按传入 Key 构建实例（`DashScopeApi.builder().apiKey(key)` + `DashScopeChatModel.builder()`），
  不再复用全局单例，否则用户 Key 不生效。

### 能力：加密配置
- 环境变量 `LLM_KEY_AES_SECRET`（`llm.api-key-crypto.secret`），任意长度，内部 SHA-256 派生 32 字节 AES 密钥。
- 未配置时：应用可正常启动、模型列表/绑定可正常使用；仅「保存 Key」与「解密已有密文」返回
  50000「服务端未配置密钥加密口令（LLM_KEY_AES_SECRET）」。
- 日志与异常信息不得打印明文 Key 或完整密文。

## 验收标准

- [ ] 迁移后存量绑定 `api_key_cipher` 为空，对话仍走配置 AK，行为不变。
- [ ] 保存 AK 后 `GET /catalog` 返回 `hasApiKey=true` 与脱敏值，响应中无明文。
- [ ] 同一 vendor 下多选模型保存后，所有绑定行密文一致，`GET /llm/models` 返回全部选中模型。
- [ ] 用户 Key 优先：配置里故意放错误 AK、用户填正确 AK 时对话成功（反向验证使用用户 Key）。
- [ ] 清除用户 AK 后同一模型回落到配置 AK。
- [ ] Key 变更后无需重启，下一次对话即用新 Key（缓存按指纹隔离）。
- [ ] 未配置 `LLM_KEY_AES_SECRET` 时保存 Key 报明确错误，不影响其它接口。
- [ ] 未选择任何模型时保存（modelCodes 为空）→ 该供应商绑定被清空、无默认模型。
- [ ] `defaultModelCode` 不在选中集合 → 40000。

## 边界与异常
- `modelCodes` 含重复 → 去重后处理，不报错。
- `apiKey` 前后空白 → trim 后为空视作「不修改」。
- 同一用户同 vendor 存在默认模型，批量保存未传 default 且原默认仍在选中集合 → 保留原默认。
- 解密失败（密文损坏 / 口令变更）→ 50000，不调用上游。
