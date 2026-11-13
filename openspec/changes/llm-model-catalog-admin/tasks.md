# 任务清单：模型目录管理

- [x] **T1** 实测供应商模型列表接口（百炼原生 / 兼容模式、DeepSeek），记录鉴权与返回结构
- [x] **T2** `UserLlmBindingRepository` 增加 `countByVendorCodeAndModelCode` 与聚合计数查询
- [x] **T3** `LlmModelRepository` 增加 `findByVendorCode`
- [x] **T4** 新增 DTO：`AdminModelItem`、`ModelSyncResult`
- [x] **T5** 新增 `LlmCatalogAdminService`：list/create/update/delete/setEnabled/sync + 供应商拉取与 TG 过滤
- [x] **T6** 新增 `AdminLlmModelController` 及请求体 `AdminModelSaveRequest` / `AdminModelEnabledRequest` / `AdminModelSyncRequest`
- [x] **T7** 前端 `api/adminModels.ts`（真实接口 + 类型）
- [x] **T8** 重写 `pages/Admin/Models.tsx`：表格 / 筛选 / 新增 / 编辑 / 删除 / 上下架 / 同步 / 静默刷新
- [x] **T9** 后端 `mvn compile`、前端 `npm run build` 通过
- [x] **T10** 接口级验证：CRUD、绑定保护、无 AK 同步报错、百炼同步 108/107，验证后清理数据
- [x] **T11** 文档同步：`PROJECT_MEMORY.md`、`.ai-context/{change-log,current-tasks}.md`、本变更目录
