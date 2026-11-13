# Design · 用户自持加密 Key

## 一、数据库（PostgreSQL，`docs/sql/015_user_llm_binding_api_key.sql`）

```sql
ALTER TABLE user_llm_binding
    ADD COLUMN IF NOT EXISTS api_key_cipher TEXT,
    ADD COLUMN IF NOT EXISTS api_key_updated_at TIMESTAMP;

COMMENT ON COLUMN user_llm_binding.api_key_cipher IS 'AES-256-GCM 密文，格式 base64(iv):base64(ciphertext)';
COMMENT ON COLUMN user_llm_binding.api_key_updated_at IS '最近一次写入用户 AK 的时间';
```

- 仅新增可空列，向后兼容；存量行 `api_key_cipher = NULL` 走配置兜底。
- 不建唯一索引：AK 是「用户 + vendor」级语义，由应用层保证同 vendor 各行密文一致。

## 二、后端结构（`com.vc.llm`）

```
crypto/ApiKeyCryptoService.java     # AES-256-GCM 加解密 + 脱敏 + 是否已配置
config/ApiKeyCryptoProps.java       # llm.api-key-crypto.secret
entity/UserLlmBinding.java          # +apiKeyCipher +apiKeyUpdatedAt
dto/CatalogVendorItem.java          # +hasApiKey +apiKeyMasked +hasFallbackKey
dto/BatchBindResult.java            # vendor/modelCodes/apiKeyMasked/hasApiKey
dto/VendorKeyStatus.java            # hasApiKey/apiKeyMasked/hasFallbackKey
service/LlmModelService.java        # batchBind / updateVendorKey / clearVendorKey / vendorKeyStatus
router/LlmModelRouter.java          # 取 Key（用户→配置）+ 缓存按指纹
factory/DashScopeVendorFactory.java # 按入参 Key 动态构建 DashScopeChatModel
vc-app/web/LlmModelController.java  # +/bindings/batch +/vendors/{vendor}/api-key
vc-app/web/BatchBindRequest.java    # {vendor, modelCodes[], apiKey?, defaultModelCode?}
vc-app/web/ApiKeyRequest.java       # {apiKey}
```

### 加解密
- `key = SHA-256(secret)` → 32 字节；`Cipher.getInstance("AES/GCM/NoPadding")`，12 字节随机 IV，128 位 tag。
- 密文格式 `Base64(iv) + ":" + Base64(ct)`，解密校验 `:` 与长度。
- 脱敏：`len >= 8` → 前 4 + `****` + 后 4；否则首 1 + `***` + 尾 1。空值返回 `null`。
- `isConfigured()`：secret 非空白。未配置时 `encrypt` / `decrypt` 抛 `BusinessException(50000, 明确文案)`。

### 服务层规则（batchBind 单事务）
1. 校验 vendor 属于 `LlmVendor` 枚举；`modelCodes` 去重；
2. 逐个校验 `llm_model` 存在、`vendor_code` 匹配、`enabled=true`；
3. 若 `apiKey` 非空 → `cipher = encrypt(trim)`；否则 `cipher = 现有密文`（取该 vendor 任一绑定行，没有则 null）；
4. 删除该 vendor 下不在 `modelCodes` 的旧绑定；
5. 新增缺失绑定，写入 `cipher` 与 `apiKeyUpdatedAt`（仅当本次有新 Key 时刷新时间）；
6. 已存在的绑定若本次有新 Key，同样更新密文与时间；
7. `defaultModelCode`：
   - 传了但不在 `modelCodes` → 40000；
   - 传了 → `clearDefaults` 后置位；
   - 没传 → 原默认仍在选中集合则保留；否则置为 `modelCodes` 第一个（空集合则无默认）；
8. 返回 `BatchBindResult`。

### 路由取 Key
```java
String apiKey = decryptIfPresent(binding.getApiKeyCipher());   // 用户 Key
if (blank) apiKey = vendorProps.apiKey(vendor);                // 配置兜底
if (blank) throw 50000 "该模型未配置密钥";
cacheKey = userId + ":" + vendor + ":" + modelCode + ":" + fingerprint(apiKey);
```
`fingerprint` = SHA-256 前 8 位十六进制，避免缓存里出现明文 Key。

### DashScope 动态实例
```java
DashScopeApi api = DashScopeApi.builder().apiKey(apiKey)
        .baseUrl(blank(baseUrl) ? 默认 : baseUrl).build();
DashScopeChatOptions opts = DashScopeChatOptions.builder()
        .withModel(model.getModelCode())
        .withTemperature(model.getTemperature().doubleValue())
        .build();
DashScopeChatModel.builder().dashScopeApi(api).defaultOptions(opts).build();
```
（现实现忽略入参复用全局 `dashScopeChatModel`，是用户 Key 不生效的根因，必须改。）

## 三、接口（context-path `/api`）

| 方法 | 路径 | 请求 | 成功 data |
|---|---|---|---|
| POST | `/llm/bindings/batch` | `{vendor, modelCodes[], apiKey?, defaultModelCode?}` | `{vendor, modelCodes, hasApiKey, apiKeyMasked}` |
| PUT | `/llm/vendors/{vendor}/api-key` | `{apiKey}` | `{hasApiKey, apiKeyMasked, hasFallbackKey}` |
| DELETE | `/llm/vendors/{vendor}/api-key` | - | 同上 |
| GET | `/llm/catalog` | - | 每 vendor 增补 `hasApiKey/apiKeyMasked/hasFallbackKey` |

保留原 `POST /llm/bindings`、`DELETE /llm/bindings/{vendor}/{modelCode}`、`PUT .../default`（兼容既有调用）。

## 四、前端（`Settings/Providers.tsx`）

- 供应商卡片：
  - 头部：名称 + code 标签 + baseUrl；
  - AK 行：`Input.Password`，占位文案按状态显示
    「已配置：sk-a****9f2c（留空则不修改）」/「使用系统兜底 AK」/「未配置 AK」；
    右侧「清除我的 AK」链接（仅 `hasApiKey` 时可用）；
  - 模型区：`Checkbox.Group` 多选（展示 modelName + modelCode），默认模型用 Radio 选择（仅已选模型可选）；
  - 底部：`保存`（调用 batch），`保存并继续`不要；未变更时禁用。
- 保存后：`getCatalog()` 静默刷新（不切 `loading`），`settingsStore.loadModels()` 刷新当前模型；
  失败仅 message，不清空已填内容。
- `api/llm.ts` 新增 `batchBindModel` / `updateVendorKey` / `clearVendorKey`；`types` 增补目录字段。

## 五、验证
1. `mvn -o -DskipTests package` 通过；`npm run build` 通过。
2. 临时端口（8125）启动后端：
   - 保存 dummy Key → catalog 显示脱敏、无明文；对话报上游鉴权错误（证明用户 Key 生效）；
   - 清除 Key → 对话恢复（配置兜底）；
   - 批量多选两个模型（若无第二个可用模型则用现有单模型 + 校验接口幂等）。
3. 验证后删除 dummy Key、停掉临时进程。
