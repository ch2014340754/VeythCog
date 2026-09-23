# agent.md · VeythCog 协作开发规范

> 本文件定义 AI Agent 与本仓库协作者的统一开发流程与约束。
> 参照 **OpenSpec / Spec-Driven Development（规范驱动开发）**：
> 每次变更先产出可审阅的规范产物，人类 review 确认后，Agent 再实现代码。
> 核心循环：**propose → review → apply → archive**。

---

## 1. 项目结构（Monorepo）

```
D:\VeythCog\
├── agent.md           本规范
├── VeythCog-V         前端（React 18 + TS + Vite + AntD 5 + Zustand）→ :3000
├── VeythCog-C         后端（Spring Boot 3.5 + Java 21 + Spring AI Alibaba）→ :8123/api
│   ├── vc-core        公共模块（BaseResponse / 异常 / 工具）
│   ├── vc-chat        对话/认证/知识库/LLM 网关主模块
│   └── vc-learn       预留
└── README.md
```

**技术栈**：后端 Spring Boot 3.5 + Java 21 + Spring AI Alibaba（DashScope / OpenAI 兼容多厂商）；
前端 React 18 + TS + Vite + AntD 5 + Zustand（persist 持久化）+ fetch/SSE。

---

## 2. 开发流程（OpenSpec：propose → review → apply → archive）

任何**非琐碎**变更（新增接口、改数据结构、跨端联调、新功能）都必须走此流程。
琐碎改动（改文案、修样式、纯 bug 局部修复）可跳过规范产物，但仍需遵守第 3、4 节约束。

### 2.1 Propose —— 先写规范，不写代码

每次变更在仓库根新建一个变更目录：

```
openspec/changes/<feature-name>/
├── proposal.md   # 为什么做、做什么（in-scope / out-of-scope）、影响面
├── specs/        # 需求 delta：行为契约、验收标准（含边界/异常）、测试场景
│   └── <capability>.md
├── design.md     # 怎么做：目录结构、数据 schema、接口签名、技术决策与备选
└── tasks.md      # 可勾选的任务清单（原子化，逐项可验证）
```

产物要求：
- **specs 用"行为 + 验收标准"描述**，不写实现细节；测试场景从一开始就写进 spec。
- **design.md 明确接口签名与字段**（前后端都以它为契约）。
- **tasks.md 每个任务可独立完成、可验证**。

### 2.2 Review —— 人类确认

- 规范产物**必须由协作者（人） review 并确认**后，Agent 才允许进入 apply。
- review 重点是：范围是否准确、接口契约是否符合预期、验收标准是否可测。
- 未确认前不写实现代码；确认后按 tasks.md 逐项推进。

### 2.3 Apply —— 按规范实现

- 严格按 design.md 的目录结构、接口签名、schema 实现。
- 写代码的同时补必要测试/验证；改完做真实运行验证（见第 4 节）。
- 一个 task 完成并验证后再进入下一个；不得跳序。

### 2.4 Archive —— 收尾

- 变更完成后，把 `specs/` 的 delta **合并回**项目长期规范文档
  （后端 `docs/architecture.md`、前端 `doc/README.md` / `TODO.md`），
  保持"当前行为 = 文档描述"一致。
- 归档后变更目录可移除或标记 archived。

---

## 3. 硬性约束

- **契约先行、前后端解耦**：接口以 OpenAPI 契约为准，前端先 mock、后端按契约实现后切换；
  切换时前端 `api/*.ts` 只替换数据来源，不改变调用方式。
- **安全红线**：
  - API Key / 密钥**一律不落前端**（localStorage / 代码 / 环境变量都不行）；密钥只存后端并加密。
  - 不硬编码真实密钥到提交文件；本地用环境变量注入。
- **端口约定**：后端 `:8123/api`（context-path `/api`），前端 `:3000`。前端默认 base 必须与后端对齐。
- **前端不感知厂商差异**：不写死厂商/模型列表、不区分厂商接口、不做厂商差异化渲染；
  厂商差异全部收敛在后端网关/工厂层。
- **会话模型绑定**（生产策略）：会话创建时选择并绑定模型，会话期间不可切换。
- **RAG / 知识库引用**：目前**只进文档不做实现**（见 TODO），需实现时单独立项走 propose 流程。
- **防烂尾**：每阶段 ≤ 3 周，超时砍范围不砍质量；每阶段结束都能运行演示。

---

## 4. 质量门（完成判定）

每项改动交付前必须：

1. **编译/构建通过**：后端 `mvn -pl vc-chat -am compile`；前端 `npm run build`。
2. **真实运行验证**：启动后端 / 前端，用真实接口跑通核心链路（登录 → 查模型 → 发消息 → 收回复）。
3. **数据可复核**：涉及数字、字段、接口返回，与代码/schema 逐一核对，不臆测。
4. **状态单一权威**：可执行规则不固化成静态结论，以代码运行结果为准。
5. **缺口披露**：未完成项、原因、影响范围在交付说明中写明，不得静默降级后宣称完成。

---

## 5. 每轮协作默认动作

- 新需求进入时：先读 `agent.md` → 检查 `docs/architecture.md`（后端）与 `doc/`（前端）现状 →
  确认是否已存在对应变更目录 / 接口。
- 设计类讨论：结论先用简洁文字 + 必要的可视化表达，不直接动手改代码，等用户确认方向。
- 用户点名"先做 X、Y 暂不做"时：严格限定范围，不越界扩展。
