# Proposal · 用户自持加密 Key（P0 收口）

> 版本 v1.0（2026-11-13）
> 依据用户拍板：**标准为用户自持加密 Key；模型配置页选择供应商后可多选模型、编辑 AK；
> `user_llm_binding` 新加字段保存 AK；配置文件中的 AK 作为最后兜底。**

## 为什么做（Why）

`openspec/llm-binding-prd.md`（v1.1）要求「用户持有自己的大模型 Key、AES 加密入库、平台不托管公共密钥」，
但当前实现是全部用户共用 `application-local.yml` / 环境变量里的平台 AK：

- 无法隔离计费与额度：一个人额度耗尽，所有账号一起不可用；
- 与 P0 PRD 契约冲突，模型配置页写着「Key 由后端统一管理」，用户无法自助换 Key；
- 多账号场景下所有人共用同一把 Key，无法演示「密钥隔离」这一面试点。

本轮只收口**密钥归属**这条主线：用户级 Key 入库、编辑、加密、脱敏回显、按用户生效，
配置文件 AK 降级为兜底。会话表 / 上下文压缩 / 访客演示模型等其余 PRD 项继续留在后续迭代。

## 做什么（What）

- 数据库：`user_llm_binding` 新增 `api_key_cipher`（AES-256-GCM 密文，`base64(iv):base64(ct)`）、
  `api_key_updated_at`；**AK 按「用户 + 供应商」维度生效**，写入该供应商下所有绑定行，保持一致。
- 后端：
  - `ApiKeyCryptoService`：AES-256-GCM 加解密 + 脱敏（前 4 后 4，短 Key 首尾各 1 位）；
    密钥来自环境变量 `LLM_KEY_AES_SECRET`（缺失时保存/解密给出明确错误，不影响应用启动）。
  - `POST /api/llm/bindings/batch`：一次提交某供应商的「多选模型 + 可选新 AK + 可选默认模型」，
    服务端按差异绑定/解绑，AK 留空表示不修改。
  - `PUT /api/llm/vendors/{vendor}/api-key`、`DELETE /api/llm/vendors/{vendor}/api-key`：单独改/清用户 AK。
  - `GET /api/llm/catalog` 增补 `apiKeyMasked` / `hasApiKey` / `hasFallbackKey`（不含明文）。
  - `LlmModelRouter`：按「用户绑定 AK → 配置 AK 兜底」取密钥；实例缓存按用户 + Key 指纹隔离，
    换 Key 后旧实例不再命中。
  - DashScope 工厂改为按传入 Key 动态构建 `DashScopeChatModel`（原先忽略入参、复用全局单例，用户 Key 不会生效）。
- 前端：模型配置页改为供应商卡片 —— 多选模型、AK 密码框（脱敏占位、留空不改）、
  保存/清除、默认模型选择；保存后静默刷新，不整块 Spin。

## 范围

### In-scope
1. 绑定表 AK 字段 + 迁移脚本 + 开发库执行。
2. AES-256-GCM 加解密与脱敏、`LLM_KEY_AES_SECRET` 配置。
3. 批量绑定 / Key 编辑 / Key 清除接口与目录字段扩展。
4. 路由层用户 Key 优先、配置兜底、缓存按 Key 指纹隔离；DashScope 动态实例。
5. 前端模型配置页重构（多选 + AK 编辑），对话页无需改动。
6. 编译、接口级验证、文档同步。

### Out-of-scope（本轮不做）
- ❌ Key 连通性校验接口（`/verify`）与 `is_valid` 门控：留待下一轮，当前以对话报错呈现连通状态。
- ❌ 会话表 `chat_session`、会话级 `ragDocIds` / 压缩开关、上下文压缩、AI 标题。
- ❌ 访客演示模型、限流、token 估算。
- ❌ Key 轮换审计、过期提醒、用量统计。

## 影响面
- 后端：`vc-llm`（entity / service / router / factory / 新 crypto）、`vc-app`（Controller / BindRequest / yml）。
- 前端：`types`、`api/llm.ts`、`Settings/Providers.tsx`。
- 数据库：`user_llm_binding` 两个新增可空列，向后兼容；存量绑定无 AK 时自动走配置兜底。

## 验收总则
登录 → 模型配置页选供应商 → 多选模型 + 填 AK → 保存 → 卡片显示脱敏 AK、模型全部选中 →
对话页用该模型发消息走用户 AK；清除 AK 后同一模型回落到配置文件 AK；换 Key 立即生效（无需重启）。
