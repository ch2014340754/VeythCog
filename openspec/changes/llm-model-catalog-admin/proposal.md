# 变更提案：模型目录管理（管理端 CRUD + 供应商同步）

- 状态：已实现（2026-11-13）
- 关联：`openspec/llm-binding-prd.md`（P0 用户自持 Key）、`openspec/changes/p0-user-llm-key/`
- 触发：用户提出「`llm_model` 只有读，没有新增/更新接口；能否改为按供应商实时查公开模型；若需要登录/收费，则在系统管理模型目录页实现各家模型的增删改查」

## 背景

`GET /llm/catalog` 的模型列表来自 `llm_model` 表，而该表此前只有启动种子（`DataInitializer` 在空表时插入 2 条），没有任何写入接口。结果：

- 新增模型（如 `qwen3.7-plus`、`deepseek-reasoner`）只能改代码或手写 SQL；
- `Admin/Models.tsx` 是纯前端 mock，开关与「设为默认」不落库，刷新即失效；
- 用户页的「多选模型」只能在两条种子里选。

## 供应商是否提供可用的模型列表 API（实测）

| 供应商 | 接口 | 鉴权 | 实测结果 |
|---|---|---|---|
| 阿里百炼 | `GET https://dashscope.aliyuncs.com/api/v1/models?page_no=&page_size=` | Bearer AK | **200**，`total=373`，`page_size` 上限 100；每条含 `model` / `name` / `capabilities` / `prices` |
| 阿里百炼（OpenAI 兼容） | `GET https://dashscope.aliyuncs.com/compatible-mode/v1/models` | Bearer AK | **200**，仅 `id` 列表，无能力字段 |
| DeepSeek | `GET https://api.deepseek.com/v1/models` | Bearer AK | 需要 AK；当前服务端 `deepseek.api-key` 为空 → **401** |

结论：**可以做同步，但必须带 AK**，且百炼返回 373 个模型里大量是语音/图像/视频（`capabilities` 为 `TTS`/`VG`/`IG`/`ASR`），只有 108 个具备 `TG`（文本生成）。因此不能把用户页目录换成「每次实时查」：

1. 目录还承载 `max_context_tokens`、`temperature`、`enabled`（上下架）与绑定校验，实时查无法表达这些；
2. 用户页每次打开都打上游接口，受分页、限流、上游波动影响；
3. 无 AK 的用户会直接看不到任何模型。

## 方案

`llm_model` 仍是目录唯一真源；管理端提供维护能力，另有「从供应商同步」作为批量补齐入口：

- 管理端（仅 `ADMIN`）：列表 / 新增 / 编辑 / 删除 / 上下架 / 同步；
- 同步：只增不删、不覆盖已有配置；百炼按 `capabilities` 含 `TG` 过滤；新增默认**不上架**，由管理员挑选；
- 同步 AK：服务端兜底配置优先，未配置时回退当前管理员的用户自持 AK（解密），都没有则明确报错；
- 删除保护：仍有用户绑定 → 拒绝并提示先下架；
- 编辑保护：已有绑定的模型不允许改供应商/编码（避免绑定行指向不存在的模型）。

## 影响

- 新接口 7 个（均在 `/admin/llm-models` 下），不改变任何现有用户侧接口语义；
- 不新增表、不新增列；`llm_model` 结构不变；
- 前端 `Admin/Models.tsx` 由 mock 改为真实接口。
