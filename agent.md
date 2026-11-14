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

---

## 6. 对话与文件产出约定（全局）

- **一律使用简体中文对话**：解释、进度说明、方案讨论、交付总结都用中文；代码、标识符、命令、报错原文、第三方专有名词保持原样，不做翻译。
- **临时文件最小化**：
  - 优先直接读写仓库文件，不生成中间副本（`.bak`、`*_new`、`*.tmp`、`*.orig` 等）；需要试跑就改完验证，验证后回退，不留副本。
  - 一次性脚本、抓取数据、导出文件、截图、浏览器 profile 等，放到系统临时目录或已忽略目录（如 `.tabbit/`），不落进 `src/`、`docs/`、`scripts/` 等交付目录。
  - **任务收尾必须清理**：删除本次生成的临时脚本、探测文件、日志、profile、临时目录。
- **只留有长期价值的产物**：源码改动、规范/契约文档、成果报告等保留；判断"是否有实际价值"时，宁缺勿滥。
- **交付时列清单**：说明中列出"保留了什么 / 清理了什么"，让协作者一眼确认仓库是干净的。
---

## 7. 动效规范（全局）

> 动效是**统一语言**，不是逐页装饰：一套令牌、一套缓动、一套降级策略。
> 参数唯一来源：`VeythCog-V/src/styles/global.css` 的 `--motion-*` / `--sheen-*`；
> 实现集中在 `VeythCog-V/src/styles/page.css` 的「动效层」「列表层」两段。
> 页面里**禁止**写死时长/缓动/位移，一律引用变量。

### 7.1 令牌（改参数只改这里）

| 变量 | 值 | 用途 |
| --- | --- | --- |
| `--motion-duration-fast` | 150ms | 颜色/描边/透明度切换 |
| `--motion-duration-base` | 250ms | 按钮微交互、列表与表格行出现 |
| `--motion-duration-slow` | 400ms | 页面切换、面板展开收起、抽屉 |
| `--motion-ease-out` | `cubic-bezier(.16,1,.3,1)` | 默认缓动（进入、悬停） |
| `--motion-ease-in-out` | `cubic-bezier(.83,0,.17,1)` | 往复类（流光、面板收放） |
| `--motion-ease-spring` | `cubic-bezier(.34,1.56,.64,1)` | 回弹（仅用于交互反馈峰值） |
| `--motion-lift` | `-2px` | 卡片悬浮抬起 |
| `--motion-lift-soft` | `-1px` | 按钮/图标按钮轻抬 |
| `--motion-press-scale` | `0.985` | 按压回弹比例 |
| `--motion-enter-distance` | `10px` | 淡入上滑位移 |
| `--motion-stagger` | `45ms` | 列表错峰步长 |
| `--motion-stagger-limit` | `10` | 错峰最多累加档位（之后不再延迟） |
| `--sheen-angle` | `105deg` | 流光扫过角度 |
| `--sheen-width` | `60%` | 流光带宽 |
| `--sheen-opacity` | 亮 `0.55` / 暗 `0.26` | 流光强度（暗色自动收敛） |
| `--sheen-duration` | `860ms` | 单次扫过时长 |

### 7.2 四类动效

1. **拟态玻璃的悬浮 / 按压 / 过渡**
   - 可交互卡片（`.vc-card--interactive`、`.vc-tool-card`）：悬停 `translateY(var(--motion-lift))` + `--shadow-md`，按压 `scale(var(--motion-press-scale))`。
   - 面板（`.vc-panel--hover`、`.vc-stat`）：悬停轻抬 `--motion-lift-soft` + 阴影，不做缩放。
   - 过渡只列具体属性（transform / box-shadow / border-color / background-color / color），**禁止 `transition: all`**。
2. **页面切换与列表进入**
   - 页面根节点（`.vc-page` / `.vc-home`）自动 `vc-fade-up`（淡入 + 上滑 `--motion-enter-distance`，`--motion-duration-slow`）。
   - 列表/网格容器加 `.vc-stagger`（`.vc-grid` 自动生效），子项按 `nth-child` 依次延迟 `--motion-stagger`，第 11 项起不再累加。
   - 表格行（`.admin-table .ant-table-tbody > tr`）同样错峰淡入，滚动懒加载追加的新行逐个出现。
3. **按钮微交互与面板展开收起**
   - 按钮：悬停 `translateY(--motion-lift-soft)`、按压 `scale(--motion-press-scale)`；`.ant-btn`、`.vc-icon-btn`、rail/dock/tab/composer 等自定义按钮统一。
   - 展开收起用 `.vc-expand`（`grid-template-rows: 0fr → 1fr` + opacity + visibility），**禁止用 `max-height` 硬编码高度**、禁止动 `height`。
   - 浮层：抽屉过渡时长/缓动统一到令牌；弹窗沿用 AntD 自带过渡，不自造第二套。
4. **卡片流光扫过**
   - 给卡片加 `.vc-sheen`（`.vc-card--interactive` / `.vc-tool-card` / `.vc-stat` 自动生效）：悬停时 `::after` 线性渐变按 `--sheen-angle` 扫过一次，频率由 `--sheen-duration` 控制，**只在 hover/focus-visible 触发，不循环**。

### 7.3 列表：不分页、全屏高度、下滑懒加载

- **默认不分页**：`pagination={false}`，禁止 `pageSize` 分页器作为默认交互（确需时须说明理由）。
- **全屏高度**：列表页用 `.vc-page--list` + `.vc-table-card--fill` + `.vc-table-fill`，页面外层不滚动，表体内部滚动，表头 `sticky` 吸顶（底色必须不透明）。
- **下滑懒加载**：统一用 `VeythCog-V/src/hooks/useInfiniteRows.ts`（`pageSize` 默认 20，提前 240px 触发，行数变化自动重置）+ `VeythCog-V/src/components/ListSentinel.tsx` 作为哨兵/底部提示。
  - 新数据到来时走 `.vc-stagger` 或表格行错峰动画；
  - 哨兵只做静态提示与触发，**不做无限循环骨架闪烁**。
- 仪表盘类多分区页面（如 `/admin/monitor`）保持页面滚动，各分区表格内部同样用该 hook 渐进展示。

### 7.4 降级（必须）

`prefers-reduced-motion: reduce` 时（`page.css` 文件末统一处理）：

- 全局把 `animation-duration` / `transition-duration` 压到 0.01ms、`animation-iteration-count: 1`、`scroll-behavior: auto`；
- 页面进入、错峰、表格行、流光全部置为静态；所有 hover 位移与缩放 `transform: none`；
- **降级后功能不等价视为缺陷**：懒加载、展开收起、路由切换必须在无动效下照常可用。

### 7.5 反模式（评审直接打回）

- 动画化 `top/left/width/height/margin`（逐帧布局）或用 `transition: all`；
- 超过 400ms 的常规过渡、超过 250ms 的交互反馈；
- 无限循环的闪烁/呼吸/旋转装饰（loading 指示器除外）；
- 页面内写死 `0.3s ease`、`translateY(-4px)`、`cubic-bezier(...)` 等魔法值；
- 用 JS `requestAnimationFrame` 自己写补间（CSS 能表达的一律用 CSS）。

### 7.6 验收

1. `cd VeythCog-V && npx tsc --noEmit` 必须 exit 0。
2. 亮 / 暗、玻璃开 / 关、壁纸开 / 关 四种组合下动效都成立，且不出现布局抖动。
3. 开启系统"减少动态效果"后，页面仍可完整操作，无残留位移或半透明卡死。
4. 长列表：首屏只渲染一页，下滑自动追加，底部提示从"已显示 x / y"变为"已加载全部 y 条"。

