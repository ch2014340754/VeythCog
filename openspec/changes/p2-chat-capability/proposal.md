# Proposal · P2 对话托管站点能力（能力注册表 + 分层挂载 + 两阶段确认）

> 版本：v1.0（2026-11-19）
> 状态：**待确认**（仅设计，未动实现）
> 关联：`design.md`（接口与机制）、`tasks.md`（分期任务）

## 为什么做（Why）

对话现在只能聊，能力全靠前端 UI 点击。要让「在对话里说一句话就把事办了」，缺的不是 function calling ——
Spring AI 1.1.2 的 `ChatClient` 原生支持 `@Tool`，缺的是**把 106 个端点变成模型可用、且安全可控的能力**：

- 端点全量暴露不可行：schema 约 1.5 万 token/请求，模型在 106 个候选里选错率高；
- 写操作直接由模型触发风险高：一次幻觉就是删数据；
- 每加一个新功能若都要手工登记、手工写 schema、手工配路由，这套东西一个月就烂掉。

目标：

1. 建立一个**能力注册表**，把 Controller 端点转成带 JSON Schema 的能力项；
2. 按「页面上下文 + 角色 + 语义召回」**分层挂载**，单次请求只挂 ≤ 12 个能力；
3. 写 / 删操作一律走**两阶段确认**（预览 → 用户确认 → 执行），执行参数以服务端存档为准；
4. **新增功能默认零登记**：读接口自动可用，写接口一行注解，新域一行配置。

## 做什么（What）

- `vc-common` 新增 `@Capability` 注解（title / risk / confirm / page / keywords，全部可选）；
- `vc-chat` 新增 `CapabilityRegistry`：启动时自动扫描 `RequestMappingHandlerMapping`，从方法签名 + DTO 反射生成 JSON Schema；
- `vc-chat` 新增 `CapabilityRouter`：域过滤 → 关键词召回 → 元能力展开；
- `vc-chat` 新增 `ActionPlanService`：计划持久化、一次性授权、过期与幂等；
- `ChatController` 新增 `/chat/capabilities`（帮助面板）、`/chat/actions/{planId}/confirm|cancel`；
- 对话 SSE 新增 `event: plan`、`event: tool_state` 两类事件；
- `LlmModelRouter` 支持按请求动态挂载 tools，并保留不支持 tool 厂商的「结构化指令」降级通道。

## 不做什么（Out of scope）

- ❌ 不接入 `DELETE` 类破坏性能力的自动执行：只允许通过显式确认卡 + 二次点击；
- ❌ 不做 SQL / DSL 生成执行（提示注入即删库）；
- ❌ 不做表格批量编辑的对话化：批量仍走 UI，对话只做「单条 / 小批（≤ 5 条）」；
- ❌ 不做跨用户共享能力、不做 admin 域对普通用户开放；
- ❌ 不做 MCP 对外暴露（本期只在进程内做能力注册，MCP 作为后续可选出口）。

## 影响面（预估）

### 后端
- `vc-common`：`capability/Capability.java`（注解）、`CapabilityDescriptor`（描述对象）；
- `vc-chat`：`capability/CapabilityRegistry`、`CapabilitySchemaBuilder`、`CapabilityRouter`、`capability/CapabilityTools`（Spring AI `@Tool` 适配层）、`plan/ActionPlanService`、`plan/ActionPlan`（表 `chat_action_plan`）；
- `vc-llm`：`LlmModelRouter.chat/stream` 增加可选 `tools` 入参（不挂则行为完全不变，老链路零回归）；
- `vc-app`：`ChatController` 新增 3 个端点；`LlmModel` 增加 `supports_tool` 标记（迁移脚本）。

### 数据库
- `chat_action_plan`（planId、userId、capabilityId、args_json、preview_json、status、expires_at、consumed_at）；
- `chat_capability_call`（审计：userId、capabilityId、planId、args_hash、status、latency_ms）；
- `llm_model.supports_tool`。

### 前端
- `src/pages/Chat/`：`PlanCard.tsx`（变更预览 + 确认/取消）、`ToolTrace.tsx`（执行过程细进度条）；
- `src/api/chat.ts`：`listCapabilities`、`confirmPlan`、`cancelPlan`；
- SSE 解析器补 `plan` / `tool_state` 事件分支；
- 执行成功后按能力声明的 `refresh` 触发对应 store 静默刷新（如 `navStore.loadBookmarks`）。

## 验收总则（可演示）

1. 首页对话输入「加个书签，掘金 https://juejin.cn」→ 出现预览卡（名称/网址/目标分类），点确认后首页网格出现新图标，无需刷新页面；
2. 输入「把刚才那个书签删了」→ 出现删除确认卡，需在卡上二次点击「删除」才执行；
3. 输入普通问题（「今天天气」）→ 请求里不挂任何 tools，token 与现在持平；
4. 对话里问「你都能干什么」→ 返回当前页面上下文可用的能力清单；
5. 新增一个只读 GET 接口后重启 → 对话可直接调用，**无需任何登记**；
6. 新增一个写接口且未加注解 → 对话**不可用**（安全默认），CI 提示「存在未评估端点」；
7 同一 `planId` 重复确认 → 第二次直接返回「已执行」，不重复落库。
