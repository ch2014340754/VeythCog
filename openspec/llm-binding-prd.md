# VeythCog P0｜模型密钥绑定 & 对话会话RAG模块 PRD

| 元信息 | 值 |
|---|---|
| 需求名 | 模型密钥绑定 & 对话会话 RAG 模块 |
| 文档路径 | `openspec/llm-binding-prd.md` |
| 归属项目 | VeythCog（渡思） |
| 生成时间 | 2026-11-06 |
| 技术栈 | Spring Boot / Spring AI / PostgreSQL + pgvector / React + TS |
| 模板类型 | P0 详细设计 PRD |
| 文档版本 | v1.1 |
| 复杂度 | 高 |
| 依赖前置 | 用户角色权限模块、知识库 RAG 模块（`openspec/api-spec.md` / `openspec/knowledge-prd.md`）、SpringAI、PostgreSQL + pgvector |
| 澄清记录 | ① 密钥由用户自持并 AES 加密入库；② 对话走 SSE 流式 + 后端持久化会话/消息；③ 访客仅用演示模型；④ 取代 `openspec/changes/p0-fullstack-connect/` 旧提案 |
| 修订记录 | 见下方「变更记录表」 |

> ⚠️ **取代声明（v1.1 新增）**：本 PRD 取代 `openspec/changes/p0-fullstack-connect/`（proposal.md / tasks.md / design.md / specs/）中关于模型管理、对话路由的旧设计。旧设计为 MySQL + 配置文件明文 AK + 同步返回 + 前端本地会话；本 PRD 改为 PostgreSQL + 用户自持 AES 密钥 + SSE 流式 + 后端持久化。两者在同一批能力上冲突，编码以本 PRD 为准，旧文件仅作历史对照。

## 变更记录表

| 版本 | 变更点 |
|---|---|
| v1.0 | 初版（P0 定稿） |
| v1.1 | 🆕 取代声明；🆕 元信息块与变更记录表；✏️ 补 AES 加密规范；✏️ 修正 yaml `baseUrl`/`modelList` 为纯字符串；🆕 `user_llm_binding.base_url` 快照；🆕 `chat_message.seq` 排序字段；✏️ 理清会话软删除与消息级联删除语义；🆕 压缩摘要存储模型；🆕 SSE 协议；🆕 消息落库时机/并发/幂等键/停止生成；🆕 会话标题生成规则；🆕 补齐会话消息/标题/详情接口；🆕 安全约束（日志脱敏/解密失败/访客演示模型）；🆕 限流/超时/监控 key；🆕 动态配置核查点 |

## 1. 概述
### 1.1 业务目标
1. 密钥隔离：**由用户持有自己的大模型API Key**，平台不统一托管公共密钥，隔离计费、风控、限流风险；
2. 服务商白名单管控：后端配置固定服务商白名单，用户不能自定义任意服务商地址；
3. 模型绑定与预校验：用户绑定模型后执行连通性验证，校验通过的模型才可在对话页选择；
4. 会话级配置：每一条对话会话独立绑定选用模型、独立绑定多选知识库文档集合、独立开关上下文自动压缩；
5. 长对话能力：对话持久化存储、支持流式输出、内置上下文动态摘要压缩，规避token超限；
6. 模块解耦：RAG检索逻辑下沉知识库模块，对话层只调用检索接口，不感知向量切片、pgvector实现细节。

### 1.2 范围界定
✅ P0 实现范围
- 服务商白名单配置（P0使用配置文件，P2迁移至后台数据表）
- 用户-模型绑定数据表、密钥AES加密存储、密钥脱敏返回前端
- 模型绑定表单：服务商联动模型下拉、Key录入、基础参数（temperature/topP）配置、备注
- 独立连通性校验接口，校验成功标记可用状态
- 对话页面模型下拉：仅展示当前用户校验通过的绑定记录
- 会话CRUD、会话独立存储：选中模型ID、绑定知识库文档ID数组、上下文压缩开关
- 对话消息持久化，区分原始消息内容、压缩摘要内容，保留双份用于溯源
- 流式对话链路：用户提问 → 可选RAG召回 → token估算 → 上下文压缩（可关闭） → 组装prompt → SpringAI动态构建OpenAI兼容ChatModel调用
- 知识库抽屉：会话内多选文档，会话记忆本次勾选文档集合
- 访客权限隔离：访客无模型绑定能力，仅使用平台预置演示模型，无自定义密钥能力

⏳ P2 预留扩展点（表结构、代码架构预留字段，P0不开发）
- 会话级System Prompt模板绑定
- 模型分组、用户默认模型设置
- 密钥过期提醒、调用用量日志、token消耗统计
- 消息重试、单条消息重生成、流式中断续传
- 模型参数预设模板、不同模型参数推荐方案
- 会话分享、对话导出
- 管理员后台：服务商白名单管理、用户绑定记录查看（密钥脱敏）

🔴 P0 不做
- 平台公共密钥、平台充值、计费体系
- 开放任意自定义OpenAI兼容地址
- 多模型并行回答、模型对比
- Function Call / 工具调用链路
- 细粒度token计费统计（仅做token估算用于上下文压缩判断）

### 1.3 权限规则（复用现有角色体系）
1. 管理员：维护服务商白名单配置；可查看用户绑定列表（密钥脱敏）；
2. 登录用户：新增/编辑/删除自身模型绑定、执行连通校验、对话选用自己已验证的模型；
3. 访客：禁止访问模型绑定页面；对话固定使用平台演示模型，无法自定义密钥、无法绑定自有模型。

### 1.4 非功能约束
1. API Key 禁止明文入库、禁止明文返回前端；
2. 连通校验使用轻量测试请求，尽量减少token消耗；
3. 上下文压缩本身也是LLM调用，压缩失败要有降级策略，不阻塞主对话流程；
4. 全部LLM调用统一基于OpenAI兼容接口，依托SpringAI OpenAiChatModel动态实例化；
5. 适配轻量服务器：RAG检索、上下文压缩尽量避免串行阻塞流式响应；增加单用户并发对话限流保护；
6. Token估算统一使用 cl100k_base tokenizer（估算值，允许误差）；知识库切片仍按字符切分（`CHUNK_SIZE=512`，见 `openspec/api-spec.md`），两者用途不同、口径分开，不混用。

## 2. 数据模型设计（PG）
> 密钥加密方案（v1.1 明确）：
> - 算法：**AES-256-GCM**；密钥（32 字节）存放于服务环境变量（如 `LLM_KEY_AES_SECRET`），禁止硬编码在代码/配置文件；
> - 每次加密随机生成 12 字节 IV（nonce），密文存储格式为 `base64(iv) + ":" + base64(ciphertext)`，GCM 自带完整性校验；
> - 前端返回时脱敏展示（前4后4，中间星号遮挡）；**短 key（长度 < 8）兜底**：只显示首尾各 1 位，其余星号，避免泄露过多；
> - 编辑回显语义：表单回显脱敏 key，若用户**未修改 key 字段 / 留空**，后端保留原密文，不覆盖。

### 2.1 服务商白名单（P0 配置文件，不建表）
`application.yml`
```yaml
llm:
  provider-white-list:
    - code: dashscope
      name: 阿里云百炼
      baseUrl: ["https://dashscope.aliyuncs.com/compatible-mode/v1"]
      modelList: [qwen3.7, qwen3.5, qwen-turbo]
    - code: openai
      name: OpenAI
      baseUrl: ["https://api.openai.com/v1"]
      modelList: [gpt-4o-mini]
```
> 约束：
> - 前端服务商下拉、模型下拉只能从该配置读取，用户不能自由输入；
> - 后端必须二次校验 `provider_code`、`model_name` 都在白名单内，不信任前端；
> - `baseUrl` 为数组（预留同服务商多地址），P0 若一个服务商配置多个 baseUrl，则绑定记录必须快照所选 `base_url`（见 2.2），否则按"model → baseUrl 唯一映射"处理。

### 2.2 用户模型绑定表 `user_llm_binding`
```sql
CREATE TABLE user_llm_binding (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    provider_code VARCHAR(64) NOT NULL,
    model_name VARCHAR(128) NOT NULL,
    base_url VARCHAR(512) NOT NULL, -- 绑定时的 baseUrl 快照（从白名单解析，防止配置变更影响历史绑定）
    api_key TEXT NOT NULL, -- AES加密存储
    temperature NUMERIC(4,2) DEFAULT 0.7,
    top_p NUMERIC(4,2) DEFAULT 0.9,
    is_valid BOOLEAN DEFAULT false, -- 是否连通校验通过
    last_verify_at TIMESTAMP WITH TIME ZONE,
    remark VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted BOOLEAN DEFAULT false
);
CREATE INDEX idx_user_llm_binding_user ON user_llm_binding(user_id, deleted);
```
业务规则：
- 同一个用户，可以同服务商+模型绑定多条记录（用于多Key隔离），不做 `(user_id, provider_code, model_name)` 唯一约束；
- `base_url` 在保存时从白名单解析并快照，避免后续白名单配置变更影响已绑定记录；
- 保存/编辑时后端校验 `provider_code`、`model_name`、`base_url` 均来自白名单。

### 2.3 对话会话表 `chat_session`
```sql
CREATE TABLE chat_session (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    session_title VARCHAR(255),
    binding_id BIGINT, -- 关联 user_llm_binding.id，当前会话选用模型绑定
    rag_doc_ids BIGINT[] DEFAULT '{}'::BIGINT[], -- 本次会话绑定的知识库文档ID数组
    enable_context_compress BOOLEAN DEFAULT true, -- 上下文自动压缩开关
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted BOOLEAN DEFAULT false
);
CREATE INDEX idx_chat_session_user ON chat_session(user_id, deleted);
```
> 补充规则：
> - `binding_id` 不设外键（绑定可被软删），但**切换/下一轮对话前必须校验**：绑定存在、属于当前用户、`is_valid=true` 且未删除；否则返回友好错误提示重新绑定；
> - `rag_doc_ids` 中的每个 docId 必须校验归属：私有库文档属于当前用户，或为演示库文档；越权 docId 直接拒绝/剔除；
> - 会话删除采用**软删除**（`deleted=true`），消息不靠 `ON DELETE CASCADE` 物理级联（见 2.4 说明）。

### 2.4 对话消息表 `chat_message`
```sql
CREATE TABLE chat_message (
    id BIGSERIAL PRIMARY KEY,
    session_id BIGINT NOT NULL REFERENCES chat_session(id) ON DELETE CASCADE,
    seq BIGINT NOT NULL, -- 会话内消息序号（单调递增，用于历史排序）
    role VARCHAR(20) NOT NULL, -- user / assistant / system
    content TEXT NOT NULL, -- 原始消息内容
    raw_token_count INT, -- 原始消息token估算值
    compressed_content TEXT, -- 压缩摘要文本
    compressed_token_count INT, -- 摘要token估算值
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_chat_message_session ON chat_message(session_id, seq);
```
> 设计说明（v1.1 明确）：
> - **排序**：历史消息按 `(session_id, seq)` 升序组装，`seq` 会话内单调，避免并发写入乱序；
> - **会话删除语义**：会话删除为软删除（`chat_session.deleted=true`），消息不物理删除（保留溯源）；`ON DELETE CASCADE` 仅作为会话被物理删除时的兜底清理；消息查询必须 JOIN 会话并过滤 `chat_session.deleted=false`；P0 不支持单条消息软删；
> - **压缩摘要存储模型**：对"最早历史"批量摘要后，**新增一条 `role=system` 的消息**，`content` 存摘要文本，`raw_token_count` 存摘要 token 估算；被压缩的原始消息不删除、原样保留；`compressed_content`/`compressed_token_count` 字段保留为 P2 单条消息级压缩/溯源标记，P0 可空；
> - **归属校验**：消息本身不冗余存 `user_id`，所有读消息接口必须经 `session_id` 校验 `chat_session.user_id` 归属，防止越权。

## 3. 页面与交互设计
### 3.1 模型绑定管理页 `/llm-binding`
页面组件：
- 新增绑定按钮；列表展示：服务商、模型名称、校验状态、temperature、topP、备注、操作按钮
- 新增/编辑弹窗：
  1. 服务商下拉（只读白名单）
  2. 模型下拉：根据选中服务商联动加载该服务商允许模型列表
  3. API Key输入框（密码框，回显脱敏）
  4. 高级参数折叠面板：temperature、topP，默认0.7 / 0.9
  5. 备注输入框
  6. 保存按钮、立即验证按钮

校验交互：点击【立即验证】，后端执行轻量连通测试；成功则更新 `is_valid=true`，记录校验时间；失败返回明确错误类型（密钥错误、额度不足、超时、模型不存在）；校验失败的绑定记录，对话下拉不展示。

### 3.2 对话主页面 `/chat`
顶部工具栏：
- 会话切换、新建会话
- 模型下拉框：只加载当前用户 `is_valid=true` 的绑定项，展示格式 `[服务商] 模型名（备注）`
- 知识库抽屉按钮
- 上下文压缩开关（默认开启，会话独立保存）

知识库抽屉交互：
- 支持知识库切换、文档复选多选
- 确认后将选中docId数组写入当前会话 `rag_doc_ids`
- 打开抽屉自动回显当前会话已勾选文档
- 新建会话默认 `rag_doc_ids = []`，默认不触发RAG检索
- 访客仅可选择演示库文档

消息区：SSE流式输出对话内容；输入框提交用户问题；
附加提示：
- 勾选知识库时，顶部小字提示：本次回答将基于选中文档检索
- 已经执行过上下文压缩时，提示：早期历史已摘要压缩

### 3.3 会话标题自动生成规则
第一轮对话助手回复完成后，调用LLM自动生成简短会话标题，用户后续可手动修改。

> 补充规则（v1.1）：
> - 标题生成**复用当前会话绑定的模型与 key**；访客（无绑定）复用平台演示模型；
> - 标题生成是额外 LLM 调用，会消耗该 key 额度，前端在会话列表可提示"标题由 AI 生成"；
> - 生成失败降级：直接截取首条 user 消息前 N 字作为标题（如 20 字），不阻塞会话；
> - 标题生成失败/未生成时，`session_title` 允许为空，前端展示兜底文案（如"新对话"）。

## 4. 核心业务流程
### 4.1 模型绑定+连通校验流程
1. 用户填写服务商、模型、key、参数、备注，提交保存；key加密入库，`is_valid=false`
2. 用户点击【立即验证】，后端解密key，构造OpenAI兼容chat请求，发送简短测试文本
3. 接口正常返回：更新 `is_valid=true`、`last_verify_at`；
4. 异常：返回错误信息，状态不修改；
5. 前端刷新列表，未验证条目不在对话模型下拉出现。

### 4.2 一轮完整对话链路（流式）
```
用户提交提问 → 读取当前会话配置：bindingId、rag_doc_ids、enable_context_compress
├─ 如果 rag_doc_ids 非空：调用知识库 retrieve 接口（POST /api/knowledge/rag/retrieve，topN 默认 5），限定 docIds 召回 chunk 片段，组装 RAG 上下文
├─ 加载当前会话全部历史消息
├─ 计算总token（历史+新问题+RAG片段）
│  ├─ 开启压缩 且 超过配置阈值：对最早历史执行摘要压缩；保留最近N轮原始对话不压缩
│  └─ 关闭压缩 / 未超限：直接使用原始消息列表
├─ 组装prompt：system预设 + 历史消息（压缩后） + RAG召回片段 + 用户当前提问
├─ 根据bindingId读取配置：provider、model、解密key、temperature、topP
├─ 动态构建 SpringAI OpenAiChatModel 实例，发起流式请求
├─ SSE流式返回结果，按落库时机持久化 user、assistant 消息（见下方说明）
└─ 回答附带RAG来源文档标题溯源信息
```

> 补充规则（v1.1）：
> - **消息落库时机**：user 消息在请求受理、校验通过后立即落库（`seq` 递增）；assistant 消息在**流式结束后**一次性落库（含完整文本 + token 估算）；中途断开/超时时，将**已累计返回的文本**落库并标记为不完整，避免丢失已生成内容；
> - **并发控制**：同一会话同一时刻只允许一个进行中的流式请求，后端以 `session_id` 加锁/乐观标记，新请求在已有请求进行中时返回友好提示（如"上一条回答仍在生成中"）；
> - **幂等键**：`stream` 请求体增加 `clientMessageId`（前端生成 UUID），后端据此去重，网络重试不重复落库 user 消息；
> - **停止生成**：前端"停止"触发中断上游 LLM 调用，已返回内容按上述规则落库，不产生新的 assistant 半截消息；
> - **RAG 溯源**：RAG 召回片段的 `title`/`docId` 在流式末尾以独立 SSE 事件返回（见 5.3 协议），前端据此渲染来源引用。

### 4.3 上下文动态压缩策略（P0固定策略，配置项控制）
1. 全局阈值（配置项，示例4000token）；保留最近N轮对话（配置项，示例3轮）不压缩；
2. 超限后，对**最早的、超出阈值的历史对话**调用LLM摘要，合并为一段摘要文本；
3. 压缩调用失败降级：直接丢弃最早消息，截断，保证对话可以继续；
4. 压缩开关会话独立，关闭压缩则不执行摘要，仅做token判断；
5. 原始消息不会删除；摘要合并后落为一条 `role=system` 消息（`content` 存摘要文本），`seq` 插在被压缩区间之后、保留区间之前（见 2.4）；
6. 压缩调用**复用当前会话绑定的模型与 key**（访客用演示模型）；压缩 token 估算同样用 cl100k_base；
7. 压缩阈值、保留轮数均为动态配置（见 7.2 核查点），代码不得写死示例值。

### 4.4 模型切换规则
- 切换模型仅作用于当前会话；
- 切换模型**不清空历史消息、不重置已勾选知识库文档**；
- 下一轮提问才使用新模型的key与参数；
- 切换模型不会自动触发RAG检索，RAG只在用户提交消息时执行。

## 5. 接口清单
前缀：`/api/llm-binding`、`/api/chat`
### 5.1 模型绑定接口
1. `GET /api/llm-binding/provider/list`：获取白名单服务商列表（前端下拉）
2. `GET /api/llm-binding/list`：获取当前用户绑定列表（key脱敏）
3. `POST /api/llm-binding/save`：新增/编辑绑定记录，key加密入库
4. `POST /api/llm-binding/verify/{bindingId}`：连通性校验
5. `DELETE /api/llm-binding/{bindingId}`：软删除绑定记录

### 5.2 会话管理接口
1. `GET /api/chat/session/list`：获取用户会话列表
2. `GET /api/chat/session/{sessionId}`：获取会话详情（bindingId、ragDocIds、enableContextCompress、标题）
3. `GET /api/chat/session/{sessionId}/messages`：获取会话历史消息列表（按 `seq` 升序，含 system 摘要消息；校验 session 归属）
4. `POST /api/chat/session/new`：新建会话，支持传入bindingId、ragDocIds
5. `PUT /api/chat/session/{sessionId}`：更新会话：切换模型、修改ragDocIds、开关上下文压缩、修改标题
6. `DELETE /api/chat/session/{sessionId}`：删除会话（软删除，消息不物理删除，见 2.4）

### 5.3 对话流式接口
1. `POST /api/chat/stream`
请求体：`sessionId, userQuestion, clientMessageId`
内部自动读取会话全部配置，完成RAG召回、token估算、上下文压缩、组装prompt、流式调用；返回SSE流式输出。

> SSE 协议（v1.1 明确）：
> - 事件类型：`delta`（增量文本）、`done`（结束，携带完整回答 + token 估算 + RAG 来源 `[{docId,title}]`）、`error`（错误，携带 code/message）；
> - 首帧错误：上游鉴权失败/额度不足/超时/模型不存在时，直接推 `error` 事件并结束，避免前端长时间转圈；
> - 幂等：`clientMessageId` 去重（见 4.2）。

> 依赖知识库已有接口：
> - `POST /api/knowledge/rag/retrieve`（召回，body `{docIds, query, topN}`，返回 `RetrieveChunk[]`，P0 `topN=5`），不改动知识库侧契约；
> - `GET /api/knowledge/list`（知识库抽屉文档列表，复用，不另建接口）。

## 6. 开发约束（给编码Agent）
1. Key解密后，不在内存长时间缓存，单次调用解密、用完即丢弃；
2. 所有LLM调用统一使用OpenAI兼容适配器，动态构建ChatModel实例，不使用单例Bean；
3. 连通校验接口单独设置较短超时，避免阻塞；错误信息区分：鉴权失败、额度不足、网络超时、模型不存在；
4. token估算组件全局复用 cl100k_base；知识库切片仍用字符切分（`CHUNK_SIZE=512`），两者不共用 tokenizer；
5. PG `bigint[]` 类型使用MyBatis-Plus自定义类型处理器映射；
6. 访客逻辑单独分支，不走user_llm_binding表；权限拦截绑定页面；访客演示模型的 provider/model/key 配置在 `application.yml` 的 `llm.demo-model` 段（后端读取，前端不感知）；
7. 流式链路异常处理：断开、超时，保证已经返回的内容落库，不丢失消息；
8. 模块边界严格隔离：
   - 知识库模块：只负责文档、切片、向量入库、向量检索接口，不感知LLM、密钥、会话；
   - 对话&绑定模块：调用RAG检索接口，不操作pgvector、不处理chunk切片；
9. 日志脱敏：错误日志、异常堆栈禁止打印明文 key 或完整密文，统一用脱敏值占位；
10. 解密失败处理：环境变量缺失/密文损坏时返回明确错误码（50000），不落库、不调用上游；
11. 所有接口二次校验资源归属：binding 属于当前用户、session 属于当前用户、ragDocIds 归属合法（私有库本人 / 演示库），不信任前端；
12. `PUT /api/chat/session/{sessionId}` 切换 `bindingId` 时，必须校验新绑定属于当前用户且 `is_valid=true`、未删除。

## 7. 风险与兜底
1. 用户密钥失效、额度耗尽：流式首帧直接返回友好错误提示，避免长时间转圈；
2. 上下文压缩调用LLM失败：降级为简单截断，保证对话可用；
3. 轻量机资源瓶颈：单用户并发对话限流，保护流式服务；
4. 向量检索和对话链路解耦：RAG检索异常时，可降级为纯对话，提示用户RAG检索失败；
5. 单用户并发对话限流、流式超时、重试策略的具体阈值/次数在 7.2 配置点定义，代码不得写死示例值。

### 7.1 监控 key（预留）
| key | 含义 |
|---|---|
| `chat.stream.duration` | 单轮流式对话总耗时 |
| `chat.stream.error` | 流式对话失败次数 |
| `chat.compress.duration` | 上下文压缩调用耗时 |
| `chat.compress.fail` | 上下文压缩失败次数 |
| `chat.rag.recall_count` | 单轮 RAG 召回片段数 |
| `llm.verify.duration` | 连通校验耗时 |
| `llm.verify.fail` | 连通校验失败次数 |

### 7.2 动态配置核查点（准则一）
> 以下均为运行时配置，代码默认值不代表实际行为，落地前必须核查当前环境实际值。

| 配置项 | 作用 | 示例值 | 需核查 |
|---|---|---|---|
| `llm.context-compress.threshold` | 上下文压缩触发 token 阈值 | 4000 | ✅ |
| `llm.context-compress.keep-rounds` | 保留不压缩的最近轮数 | 3 | ✅ |
| `llm.rate-limit.per-user-concurrency` | 单用户并发对话限流 | 待定 | ✅ |
| `llm.stream.timeout` / `retry` | 流式超时与重试策略 | 待定 | ✅ |
| `llm.demo-model` | 访客演示模型 provider/model/key | 待定 | ✅ |
| `llm.provider-white-list` | 服务商白名单 | 见 2.1 | ✅ |
| `LLM_KEY_AES_SECRET` | AES 密钥（环境变量） | — | ✅ |

