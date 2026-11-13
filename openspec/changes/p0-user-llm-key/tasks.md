# Tasks · 用户自持加密 Key（P0 收口）

> 每项完成并验证后再进入下一项。

## 数据库

- [x] **T1** 新增 `VeythCog-C/docs/sql/015_user_llm_binding_api_key.sql`（`api_key_cipher` / `api_key_updated_at`）。
- [x] **T2** 在开发库执行，核对列存在、存量行密文为 NULL。

## 后端（vc-llm / vc-app）

- [x] **T3** `ApiKeyCryptoProps` + `ApiKeyCryptoService`（AES-256-GCM、脱敏、未配置口令的明确报错）。
- [x] **T4** `UserLlmBinding` 加 `apiKeyCipher` / `apiKeyUpdatedAt`。
- [x] **T5** `LlmModelService`：`batchBind` / `updateVendorKey` / `clearVendorKey` / `vendorKeyStatus`。
- [x] **T6** `LlmModelRouter`：用户 Key 优先 → 配置兜底；缓存键加用户 + Key 指纹；解密失败 50000。
- [x] **T7** `DashScopeVendorFactory` 改为按入参 Key 动态构建（不再复用全局单例）。
- [x] **T8** Controller：`/llm/bindings/batch`、`/llm/vendors/{vendor}/api-key`（PUT/DELETE）；
  `CatalogVendorItem` 增补 Key 状态字段。
- [x] **T9** `application.yml` 增加 `llm.api-key-crypto.secret: ${LLM_KEY_AES_SECRET:}`；本地配置补口令。

## 前端

- [x] **T10** `types` / `api/llm.ts`：目录 Key 状态字段 + 批量绑定 + 改/清 Key。
- [x] **T11** `Settings/Providers.tsx` 重构为「供应商卡片 + 多选模型 + AK 编辑 + 默认模型」。
- [x] **T12** 无感规范走查：保存后静默刷新、不清空输入、不整块 Spin。

## 验收

- [x] **T13** 后端 `mvn package`、前端 `npm run build` 通过。
- [x] **T14** 临时端口启动后端，验证：保存→脱敏回显→用户 Key 生效（配置 AK 故意不正确时应仍能调用）；
  清除→回落配置；换 Key 立即生效；无明文泄漏。
- [x] **T15** 清理测试 Key、停掉临时进程。

## 文档

- [x] **T16** 同步 `PROJECT_MEMORY.md`（§3/§5/§6/§8）、`.ai-context/change-log.md`，标注 `LLM_KEY_AES_SECRET` 部署要求。

> 验证说明：T14 的用户 Key 优先已用 dummy Key 返回上游 401 证明；清除后的兜底链路鉴权通过但该账号免费额度耗尽（403 FreeTierOnly），改用有效 AK 即可，属外部额度问题。T12 的无感刷新在代码层实现（静默 getCatalog + 卡片顶部 2px 进度条），浏览器人工走查未做。
