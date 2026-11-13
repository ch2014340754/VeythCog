# 设计：模型目录管理

## 1. 为什么不让用户页实时查供应商

实测数据支撑（2026-11-13，使用本地配置的百炼 AK）：

- 百炼 `GET /api/v1/models`：`total=373`，其中 `TG`（文本生成）108 个，其余为 `TTS`（59）/`VG`（80）/`IG`（43）/`ASR`（13）等；
- 同一接口还返回 `prices`、`capabilities`、`published_time` 等，用户页并不需要；
- DeepSeek `/v1/models` 必须带该供应商 AK，当前服务端未配置。

因此目录保持「库为真源」，把上游数据只作为**管理端的同步来源**：

- 用户页只读库，稳定、可控（上下架、排序、绑定校验都靠库）；
- 管理页可同步补齐，也可手工维护；
- 不给用户页引入上游依赖与额外延迟。

## 2. 数据与接口

不新增表/列。`llm_model` 仍为：

`vendor_code / model_code / model_name / max_context_tokens / temperature / enabled / create_time`，唯一键 `(vendor_code, model_code)`。

新增 `vc-app/web/AdminLlmModelController`（`@RequestMapping("/admin/llm-models")`），由 `SecurityConfig` 既有的 `/admin/** → hasRole("ADMIN")` 统一保护；服务层新增 `vc-llm/service/LlmCatalogAdminService`。

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/admin/llm-models` | 全部模型 + `bindingCount` |
| GET | `/admin/llm-models/vendors` | 供应商枚举选项 |
| POST | `/admin/llm-models` | 新增 |
| PUT | `/admin/llm-models/{id}` | 编辑 |
| DELETE | `/admin/llm-models/{id}` | 删除（有绑定拒绝） |
| PUT | `/admin/llm-models/{id}/enabled` | 上架/下架 |
| POST | `/admin/llm-models/sync` | 从供应商同步 |

`bindingCount` 通过一条聚合查询 `countGroupedByVendorAndModel()` 得出，避免 N+1。

## 3. 同步实现要点

- HTTP 客户端用 JDK `HttpClient`（10s 连接 / 20s 请求超时），不引新依赖；JSON 用 Spring 管理的 `ObjectMapper`。
- 百炼分页：`page_size=100`，最多 10 页；`capabilities` 可能是字符串 `"TG"` 或数组 `["TG","VU","Reasoning"]`，两种都判。
- 过滤后按 `model` 去重，名称截 64 字符（表字段限制）。
- 只补缺失：先按 `vendor_code` 一次性取已有 `model_code` 集合，再逐个插入；因此重复同步 `added=0`。
- 事务：整个 sync 包在一个事务内，中途异常不会留下半批数据。已知代价：事务内包含上游 HTTP 调用（最长约 20s/页），上游慢时会占用数据库连接；后续可拆成「先 fetch、再 apply」两步短事务。
- Key 解析顺序：配置 AK → 管理员用户 AK（`ApiKeyCryptoService.decrypt`）→ 40000。解密失败给出「口令可能已变更，请重新保存」提示。

## 4. 前端

`VeythCog-V/src/api/adminModels.ts`（新）+ `pages/Admin/Models.tsx`（重写，原为 mock）：

- 表格列：供应商 / 模型（名称 + 编码）/ 上下文 / 温度 / 绑定数 / 状态开关 / 操作；
- 顶部：全部·已上架·未上架 分段筛选 + 供应商筛选 + 「从供应商同步」+「新增模型」；
- 变更后 `load(true)` 静默刷新（保留旧内容 + 顶部 2px 细进度条），仅首次加载显示居中 Spin；
- 编辑弹窗在有绑定（`bindingCount>0`）时锁定供应商与编码输入；
- 删除用 Popconfirm，有绑定时禁用并在 title 里说明原因；
- 同步弹窗：供应商 + 「新增项直接上架」开关 + 说明；完成后弹窗列出新增编码（最多 40 个）。

## 5. 验证记录（2026-11-13，临时端口 8125）

| 用例 | 结果 |
|---|---|
| 初始列表 | 2 条：`dashscope/qwen-plus`（bindings=1）、`deepseek/deepseek-chat`（0） |
| 新增 `deepseek/deepseek-reasoner` | 200，返回 id=3、enabled=true |
| 重复新增同编码 | 40000「该供应商下已存在模型 deepseek-reasoner」 |
| 编辑为 `DeepSeek R1` / 131072 / 0.5 | 200，字段全部生效 |
| 下架 | 200，`enabled=false` |
| 删除该模型 | 200，`true` |
| 删除 `qwen-plus`（有 1 条绑定） | 40000「仍有 1 条用户绑定…」 |
| 把 `qwen-plus` 改编码 | 40000「已被 1 位用户绑定，不能修改…」 |
| `deepseek` 同步（无 AK） | 40000「该供应商未配置 API Key…」 |
| `dashscope` 同步 | 200，`total=108`、`added=107`、`skipped=1`（qwen-plus 已存在）；新增行 `enabled=false`、`vendorName` 正确 |
| 清理 | 通过 API 删除 107 条新增行，列表恢复 2 条，`qwen-plus` 仍 default=true |

> 测试后已通过 API 删除同步产生的 107 行，开发库恢复原状（2 行目录 + 1 条绑定）。临时 8125 实例已停。
