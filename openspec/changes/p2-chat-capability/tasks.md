# Tasks · 对话托管站点能力

> 版本：v1.0（2026-11-19）｜状态：待确认后开工

## P0 · 骨架与零成本验证（1 天）

- [ ] `vc-common`：`@Capability` 注解（title/description/keywords/page/refresh/enabled/previewText）
- [ ] `vc-chat`：`CapabilityDescriptor` + `CapabilitySchemaBuilder`（DTO 反射 → JSON Schema）
- [ ] `vc-chat`：`CapabilityRegistry` 启动扫描 `RequestMappingHandlerMapping`，套用 §2.2 过滤规则与风险默认值
- [ ] 单测：`CapabilityRegistryTest` 打印已注册/已禁用清单，确认 nav/todo 读接口自动可用、写接口默认 disabled
- [ ] `GET /chat/capabilities` 返回清单（便于人工核对）

## P1 · 读能力打通（0.5 天）

- [ ] `LlmModelRouter.chat/stream` 增加可选 tools 入参（缺省不变，跑一遍老链路回归）
- [ ] `CapabilityTools` 适配层：把能力包装成 Spring AI 可调用的 `@Tool` 描述
- [ ] 仅挂载 `read` 能力，验证「问一句话 → 模型调 list_open_todos 拿到数据」闭环
- [ ] 断言：不带意图的普通问答 payload 中无 `tools`

## P2 · 两阶段确认（1 天）

- [ ] `chat_action_plan` 表 + 迁移脚本（唯一约束：planId、consumed_at）
- [ ] `ActionPlanService`：create / get / confirm / cancel，5 分钟过期，一次性消费
- [ ] 执行参数只从 plan 取，重新 `@Valid` 校验
- [ ] SSE 新增 `event: plan`、`event: tool_state`
- [ ] 前端 `PlanCard.tsx`：字段级 diff + 确认/取消；删除类二次点击
- [ ] 前端 `ToolTrace.tsx`：细进度条，不阻塞正文流

## P3 · 分层挂载（0.5 天）

- [ ] `CapabilityRouter`：意图闸门（规则）→ 域过滤（page/角色）→ 关键词召回 Top-8 → 排序稳定
- [ ] 元能力 `capability_search`
- [ ] `ChatRequest` 增加 `page` / `contextId`，前端 Chat 页按路由填

## P4 · 首批能力注册（0.5 天）

- [ ] `nav` 域：`nav.category.list`、`nav.bookmark.list`、`nav.bookmark.create`(write)、`nav.bookmark.move`(write)、`nav.bookmark.delete`(destructive)
- [ ] `todo` 域：`todo.list_open`、`todo.create`(write)、`todo.toggle`(write)
- [ ] 能力描述文案打磨（Top-10 手写 description，其余自动回退）

## P5 · 治理与自动化（0.5 天）

- [ ] 审计表 `chat_capability_call`
- [ ] 限额：单轮 ≤ 5、每分钟 plan ≤ 10、失败 3 次冷却 10 分钟
- [ ] CI 漂移检测：端点集合 vs 能力表差集告警
- [ ] `llm_model.supports_tool` + 结构化指令降级通道
- [ ] 记忆顾问 tool 消息过滤（§8 验证项，若确认会落库再实现）

## 不排期

- MCP 对外暴露、DSL/SQL 生成执行、批量表格对话化
