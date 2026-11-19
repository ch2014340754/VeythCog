# Design · 对话托管站点能力

> 版本：v1.0（2026-11-19）
> 状态：**待确认**
> 前置：`proposal.md`

---

## 0. 结论先行（新增功能要不要手动调）

| 你新增的东西 | 需要手写的东西 | 说明 |
|---|---|---|
| 一个**只读**接口（GET） | **0 行** | 启动自动注册，GET 默认 `risk=read`、免确认、可对话 |
| 一个**写**接口（POST/PUT） | **1 行注解** `@Capability(title="…")` | 默认 `confirm=preview`；**不加注解则不进对话**（安全默认，不会因为你忘了登记就把写能力漏给模型） |
| 一个**删除**接口（DELETE） | **1 行注解** | 默认 `confirm=explicit`，必须卡片二次点击 |
| 一个**新业务域**（新模块/新路径前缀） | **1 行配置**（域名 → 页面上下文映射） | 域名自动取路径首段，只有「在哪个页面挂载它」需要你决定 |
| 想提高召回准确率 | 可选 `keywords` | 只在实测召回不准时补，不补也能用 |

也就是说：**注册、Schema、绑定、风险定级、路由分组全部自动；只有语义和「要不要进对话」需要人决定，且写操作是 1 行注解。**

---

## 1. 能力描述表（Capability Descriptor）

能力项是「端点」的可对话投影，一条能力对应一个 `HandlerMethod`。

```jsonc
{
  "id": "nav.bookmark.create",          // 自动：域.资源.动作（由路径 + 方法名推导，可被注解覆盖）
  "domain": "nav",                      // 自动：路径首段
  "handler": "POST /nav/bookmarks",     // 自动：绑定端点
  "title": "新增导航书签",               // 语义层：注解或 yml（缺省回退 "POST /nav/bookmarks"）
  "description": "为导航首页某个分类新增一个网站图标；需要网址与标题，可指定分类名",  // 语义层
  "input_schema": {                     // 自动：方法签名 + DTO 反射生成
    "type": "object",
    "properties": {
      "title":  { "type": "string", "maxLength": 60, "description": "书签名称" },
      "url":    { "type": "string", "format": "uri", "description": "网站地址" },
      "categoryName": { "type": "string", "description": "目标分类名称，缺省当前分类" }
    },
    "required": ["title", "url"]
  },
  "risk": "write",                      // 自动推导：GET=read，POST/PUT=write，DELETE=destructive
  "confirm": "preview",                 // 自动：write→preview，destructive→explicit，read→none
  "visibility": "user",                 // 自动：/admin/** → admin，/auth/**、/actuator/**、流式端点 → hidden
  "requiredRole": "USER",               // 自动：继承端点现有鉴权注解
  "page": ["home"],                     // 语义层（域级配置即可，无需逐条写）
  "keywords": ["加个书签", "收藏网址", "常用网站", "添加图标"],
  "refresh": ["nav.bookmarks"],          // 执行成功后前端要静默刷新的信号名
  "enabled": true
}
```

字段分两类，**只有第二类需要人写**：

| 分类 | 字段 | 来源 |
|---|---|---|
| 自动 | `id`/`domain`/`handler`/`input_schema`/`risk`/`confirm`/`visibility`/`requiredRole` | 扫描端点 + 反射 DTO |
| 语义 | `title`/`description`/`keywords`/`page`/`refresh`/`enabled` | `@Capability` 注解 或 `capability.yml` 覆盖 |

覆盖优先级：`yml` > 注解 > 自动推导。这样批量调整（比如整个 `music` 域临时下线对话入口）可以只在 yml 改一行。

---

## 2. 自动发现（CapabilityRegistry）

### 2.1 扫描源

启动阶段拿 `RequestMappingHandlerMapping#getHandlerMethods()`，遍历所有 `@RequestMapping` 方法：

1. 取 `path pattern` + HTTP 方法 + `HandlerMethod`；
2. 参数拆三类：
   - `@PathVariable` / `@RequestParam` → 进 `input_schema.properties`（`required` 按 `required=true` 或无默认值判定）；
   - `@RequestBody` DTO → 反射字段（复用现有 `@NotBlank`/`@Size`/`@NotNull`，直接映射 `required`/`maxLength`/`format`）；
   - 上传（`MultipartFile`）、`SseEmitter`、`HttpServletResponse` → 标记 `visibility=hidden`（不进对话）；
3. 返回值 `BaseResponse<T>` → 剥掉包装，只取 `T` 生成 `output_hint`（用于让模型知道「执行后能拿到什么」，不参与 schema 校验）。

> 现状：`vc-app` 已引 springdoc 2.8.9 + knife4j，但控制器上 **0 条 `@Operation`**，自动生成的 summary 只有 `POST /nav/bookmarks`。
> 因此**不依赖 OpenAPI 文档**做语义，只借它做交叉校验；语义一律走注解/yml。

### 2.2 过滤规则（自动，无需人工维护排除清单）

| 规则 | 结果 |
|---|---|
| 路径前缀 `/auth`、`/admin`（非 admin 角色）、`/actuator`、`/health` | `hidden` |
| `produces = text/event-stream`、返回 `SseEmitter`、`ResponseEntity<byte[]>`、`MultipartFile` | `hidden`（流与二进制不进模型） |
| `POST /chat/**` | `hidden`（避免模型递归调用自己） |
| HTTP 方法为 DELETE | `destructive` + `explicit` |
| 其余 GET | `read` + `none`，`enabled=true` |
| 其余写方法 | `write` + `preview`，**`enabled=false`**（安全默认，需一行注解开启） |

`enabled=false` 的能力**不出现在任何挂载列表**，但在 `/chat/capabilities?include=disabled` 里可查，方便你决定要不要开。

### 2.3 Schema 生成细节

- DTO 反射走 Jackson `ObjectMapper` 的 `accept()` 结果，而不是手写 JSON Schema，保证与真实反序列化行为一致（比如 `LocalDate`、枚举、`@JsonFormat`）；
- 参数名与描述：`@Schema(description=…)` / `@Parameter` 若存在则优先，其次 `@Capability` 的 `fields` 局部覆盖，最后为空；
- `additionalProperties: false`，避免模型自由发挥塞未知字段。

### 2.4 漂移检测（回答「以后会不会漏」）

`CapabilityRegistryTest`：断言「已注册能力集合」与「端点集合」的差集，新增端点未评估时输出 warning 清单（不阻断构建）。这样你加完功能跑一次测试，就知道哪些写接口还没决定要不要进对话。

---

## 3. 分层挂载（CapabilityRouter）

目的：把「一次能挂多少能力」压到 8~12 个，既控 token 又保准确率。

```
请求进入 ChatController
  ├─ 0. 意图闸门（零模型成本）：关键词/正则命中「操作类」才继续；否则不挂 tools，普通对话
  ├─ 1. 域过滤：page（当前前端页面）+ 角色 → 保留 2~3 个域（首页=nav+todo，知识库=knowledge，音乐=music）
  ├─ 2. 语义召回：域内按关键词/BM25 取 Top-8（纯内存打分，不调模型）
  ├─ 3. 元能力兜底：恒挂 `capability_search(query)`，模型没找到时自己再去检索一次
  └─ 4. 排序稳定：按 capabilityId 字典序输出，保证同一意图下工具前缀逐字节一致 → prompt cache 命中
```

- **意图闸门**用的是规则 + 现有 `QuickAiController` 的轻量分类，不额外调模型；
- 前端在请求里带 `page` 与 `contextId`（如 `home` / `knowledge:123`），没有则按用户当前路由推断；
- `capability_search` 返回的仍是能力描述（不含 schema），模型确认后再用一次调用取 schema —— 避免全量 schema 常驻。

**缓存约束（关键）**：`LlmModelRouter` 现按 `userId+vendor+model+key指纹+地址指纹` 缓存 `ChatClient`。
tools 必须通过 `chatClient.prompt().tools(...)` **按请求传**，绝不能塞进 `ChatClient.builder().defaultTools()`，否则动态工具会污染缓存键、导致实例爆炸且换页后旧工具残留。

---

## 4. 两阶段确认协议

### 4.1 状态机

```
            ┌────────── read ──────────► 直接执行 ──► 结果回填上下文
请求 ──┤
            └── write/destructive ──► PLAN_CREATED ──confirm──► EXECUTED
                                        │                      
                                        ├──cancel──► CANCELLED
                                        └──5min过期──► EXPIRED
```

### 4.2 关键设计：执行参数以服务端存档为准

模型第一次调用工具时**不直接执行**，而是把参数写进 `chat_action_plan` 并返回 `planId`。
用户点确认时，后端**从 plan 里读参数**执行，**不接受前端/模型再次提交的参数**。这样：

- 模型无法在第二轮改参数（防止「预览 A、执行 B」）；
- plan 与 `userId` 强绑定，别人拿到 planId 也执行不了；
- `planId` 一次性消费（`consumed_at` + 唯一约束），重复确认返回「已执行」而不是再落一次库。

### 4.3 预览内容（`preview_json`）

```jsonc
{
  "capabilityId": "nav.bookmark.create",
  "summary": "将在「常用」分类新增书签「掘金」",
  "changes": [
    { "field": "title", "after": "掘金" },
    { "field": "url",   "after": "https://juejin.cn" },
    { "field": "category", "after": "常用" }
  ],
  "sideEffects": ["导航首页图标 +1"],
  "destructive": false,
  "expiresInSec": 300
}
```

- 通用预览由 Registry 统一生成（读 DTO 字段 → 字段级 diff），**不需要为每个功能写渲染器**；
- 只有需要「人话摘要」的能力才在 `@Capability` 里补 `previewText` 模板，缺省用 `将在「X」新增/修改 …` 的通用句式。

### 4.4 删除类能力

`confirm=explicit`：卡片上必须有独立按钮，且点击后再弹一次确认（「确认删除，不可恢复」）。自然语言里的「删」只生成 plan，不构成执行授权。

### 4.5 批量阈值

单次 plan 涉及记录数 > 5 → 强制 `explicit`，并在预览里列出前 5 条 + 总数；超过 20 条直接拒绝并提示去 UI 操作。

---

## 5. 接口设计

### 5.1 REST

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/chat/capabilities?page=home&include=disabled` | 能力清单（帮助面板 / 调试用），不含 schema |
| GET | `/chat/actions/{planId}` | 查 plan 状态（前端超时后回查） |
| POST | `/chat/actions/{planId}/confirm` | 确认执行，幂等；返回 `{status, resultSummary, refresh}` |
| POST | `/chat/actions/{planId}/cancel` | 取消 |

请求体一律为空（参数全部取自 plan），鉴权沿用现有 JWT + `currentUserId()`。

### 5.2 SSE 事件（在现有 `references` / `data` 之外新增）

| event | data | 时机 |
|---|---|---|
| `tool_state` | `{capabilityId, phase: "planning"\|"executing"\|"done", label}` | 模型决定调用 / 真正执行 / 结束 |
| `plan` | `preview_json` + `planId` | 写操作生成计划后，正文之前或之后均可 |
| `artifact` | `{fileId,name,mime,size,url}` | 生成文档类能力（预签名 URL） |
| `error` | 现有结构不变 | —— |

前端在 `tool_state` 阶段只显示细进度条（遵守无闪烁规范），不阻塞正文流。

---

## 6. 安全边界

1. **身份**：`userId` / 角色取自 `SecurityContext`，能力的 `requiredRole` 在执行前再校验一次，模型给的任何参数都不参与授权判断；
2. **参数**：plan 存档的原始 JSON 在执行时重新反序列化为 DTO 并跑 `@Valid`，等价于「再走一遍 Controller 校验」；
3. **越权**：能力直接调 Service（不绕 Controller 的鉴权），因此 Registry 必须自己补上归属校验（`userId` 过滤已在 Service 层实现，保持复用）；
4. **限额**：单轮工具调用 ≤ 5；单用户每分钟生成 plan ≤ 10；同一能力连续 3 次失败进入 10 分钟冷却；
5. **审计**：`chat_capability_call` 落 capabilityId、planId、args_hash（不落明文）、status、latency；
6. **注入**：能力只映射到固定 Service 方法，不存在模型可控的 SQL / URL 拼接；URL 类参数走 http(s) 白名单；
7. **递归**：`/chat/**` 端点永不注册为能力。

---

## 7. 降级通道（不支持 tool 的厂商）

`llm_model.supports_tool=false` 时不挂 tools，改为：

1. system prompt 注入**精简能力目录**（只给 id + 一句话 + 参数名，≤ 10 条）；
2. 要求模型只输出 `{"capability":"nav.bookmark.create","args":{…}}` 或 `{"capability":null}`；
3. 后端解析 → 同样的 Registry 校验 → 同样的 plan 协议 → 同样的确认卡。

即：**协议不变，只换传输方式**。前端与 plan 层完全复用。

---

## 8. 与现有代码的接缝

| 现有实现 | 改动 |
|---|---|
| `LlmModelRouter.chat/stream` | 增加可选 `List<CapabilityTool>` 参数，缺省为空 → 老链路行为与 token 完全不变 |
| `ChatClient` 缓存 | 不变（tools 走 prompt 层，不进 `builder`） |
| `MessageChatMemoryAdvisor` | **需验证**：tool_call / tool_response 消息是否会被记忆顾问写进历史；若是，需在 `MyBatisChatMessageRepository` 过滤 `TOOL` 角色，避免历史膨胀与重复执行诱因 |
| `RagChatOrchestrator` | 检索注入在工具结果之后再做一次，避免工具结果被 RAG 上下文覆盖 |
| `ChatSessionService.resolveForSend` | 增加 `page` / `contextId` 字段（可空，兼容旧客户端） |

---

## 9. 风险与权衡

| 风险 | 应对 |
|---|---|
| 语义层描述写得差 → 召回/选错工具 | 先把 Top-10 高频能力的人工描述打磨好，其余用自动回退；`capability_search` 兜底 |
| 模型多步串联（先查分类再建书签） | 明确允许，但单轮 ≤ 5 次调用；每步都受同一限额约束 |
| 前端页面上下文缺失（新客户端/移动端） | 缺省按 `home` 处理，域过滤放宽到 nav+todo |
| 能力数量继续增长 | 域过滤保证单次 ≤ 12；域再细分（如 `knowledge.doc` / `knowledge.folder`） |
| 记忆里残留 tool 消息 | 见 §8 的过滤方案，属于必须验证项 |
| 你以后真忘了标注写接口 | 默认 `enabled=false` + CI 漂移告警，最坏结果是「没进对话」，不是「误删数据」 |

---

## 10. 验证方式

1. **能力表快照**：启动后导出 `capabilities.json`，与上一版 diff，确认新增端点只出现在 disabled 列表；
2. **不挂载回归**：普通问答请求的 payload 断言无 `tools` 字段，token 与改动前一致；
3. **确认协议**：手工构造 planId 重放、跨用户 planId、过期 planId 三种用例均被拒；
4. **端到端**：首页说一句话 → 卡片 → 确认 → 首页静默刷新，全程无整页闪烁。
