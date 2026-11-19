# Proposal · P1 统一工作台（首页「今日」视图）

> 版本：v1.0（2026-11-19）
> 状态：待 review（「待确认」7 条拍板后再 apply）
> 关联：`agent.md` §2 流程、`PROJECT_MEMORY.md` §7（前端架构）、`openspec/changes/p1-nav-homepage/design.md`（首页现状）

## 为什么做（Why）

首页 `/home` 目前是 iTab 风格书签墙（壁纸 + 时钟 + 搜索 + 分类网格 + Dock），视觉完整但**信息上是静态的**：

- 打开首页看到的是一排固定入口，没有任何「今天该干什么 / 有什么变化」的信息；
- 系统里已经积累了 5 类真实数据——知识库文档、未处理剪藏、对话会话、导航书签、音乐——但**没有任何一处把它们聚合成一个视图**，用户要逐个页面点进去才知道有什么新东西；
- `clipPending` 角标只在 `MainLayout` 里每 60s 轮询（`layouts/MainLayout.tsx` L31-35），而 `/home` 是挂在 `MainLayout` **之外**的独立路由（`App.tsx` L165-172），所以**首页反而看不到收件箱角标**——这是当前真实存在的一个信息盲区。

结论：不缺页面，缺的是「第一屏有用」。本轮不新增模块，只把已有数据组织成「今日」视图，同时保持书签墙原样可用。

## 做什么（What）

一句话：**在 `/home` 内新增可切换的「今日」视图（默认进入），由一个后端聚合接口一次带回待办、最近文档、未读剪藏、最近对话与统计；原书签墙作为「导航」视图原样保留。**

### 后端

1. 新增 `GET /workbench/overview`（`vc-app/web/WorkbenchController` + `com.vc.app.workbench.WorkbenchService`）：
   - 并行调用已有服务（`KnowledgeService` / `ClipService` / `ChatService` / `NavCategoryService`），**不新增任何业务表**；
   - 单项失败降级为空集并置 `partial=true`，不整体 500。
2. 派生待办（真实数据算出来，不是 mock）：
   - 未处理剪藏：`clip_item.status = 'pending'` 计数；
   - 待向量化文档：`is_vectorized = false` **且正文长度 ≥ 200 字**的文档数（过滤空白草稿）。
3. `user_setting` 增加 `home_view`（`today` / `nav`），复用现有 `GET/PUT /user/setting`。
4. 可选：`POST /workbench/briefing` 生成一句「今日速览」（命中缓存 + 失败静默降级，不阻塞首屏）。

### 前端

1. `pages/Home` 拆出 `today/` 子目录：`TodayView` / `TaskStrip` / `RecentDocs` / `UnreadClips` / `RecentChats` / `QuickActions` / `Briefing` / `today.css`，`Home/index.tsx` 只负责视图切换与原有书签逻辑。
2. 视图切换：顶部（时钟下方）分段 pill「今日 / 导航」，键盘 `←/→` 或 `1/2` 可切；切换不销毁另一视图的滚动位置与分类选中态。
3. 数据走 `useWorkbenchOverview` hook：进页拉取 → `sessionStorage` 5 分钟缓存先渲染旧值 → 后台静默刷新 → 右上角细进度条（复用 `PageLoadingBar` 的 docked 形态），不闪、不整块 Spin。
4. 角标轮询上移：把 `MainLayout` 的 clip 轮询提升到 `RootLayout`，首页与内页共用一份，避免两套定时器。

## 范围（Scope）

### In-scope

| 能力 | 说明 |
|---|---|
| 今日视图 | 问候 + 日期、待办条、最近更新文档（含目录路径）、未读剪藏、最近对话、快捷动作、轻统计 |
| 视图切换 | 今日 / 导航 pill，偏好持久化到 `user_setting.home_view` |
| 聚合接口 | 一次请求返回上述全部数据，内部并行 + 超时 + 降级 |
| 派生待办 | 未处理剪藏、待向量化文档；点击直达对应页面并带上筛选 |
| 无感刷新 | 保留旧内容 + 细进度条；切回首页 60s 内不重复拉取 |
| 空态 | 无待办 / 无文档 / 新账号三种空态文案与引导动作 |
| 移动端 | 单列布局，卡片顺序重排（待办置顶） |

### Out-of-scope

- ❌ **真正的待办 CRUD**（不建 `todo` 表、不做勾选/提醒/重复规则）——本轮只做「派生待办」；
- ❌ 日历 / 日程集成、与飞书日程联动；
- ❌ 图表化统计大屏（趋势折线、热力图）——只在卡片角落放 3-4 个静态数字；
- ❌ 消息通知中心 / 未读红点体系（角标沿用现有 clip 机制）；
- ❌ 首页可拖拽自定义布局（卡片顺序固定，后续再谈）；
- ❌ 定时任务引擎（`Admin/Tasks` 仍为 mock，本 change 不碰）；
- ❌ 修改 `/home` 现有书签/壁纸/分类/Dock 的任何交互。

## 影响面

### 数据库

- `025_user_setting_home_view.sql`：`ALTER TABLE user_setting ADD COLUMN home_view VARCHAR(16) NOT NULL DEFAULT 'today'`（幂等，带 `IF NOT EXISTS`）。
- 无新表。待办、统计全部由现有表实时计算。

### 后端

| 文件 | 动作 |
|---|---|
| `VeythCog-C/docs/sql/025_user_setting_home_view.sql` | 新增 |
| `vc-app/.../web/WorkbenchController.java` | 新增（`/workbench/overview`、可选 `/workbench/briefing`） |
| `vc-app/.../workbench/WorkbenchService.java` + `WorkbenchOverview` 等 DTO | 新增 |
| `vc-app/.../web/UserSettingController.java`、`dto/UserSettingView/Patch` | 加 `homeView` 字段 |
| `vc-knowledge/.../service/KnowledgeService` | 加 `countPendingVector()`、`listRecent(n)` 两个只读方法 |
| `vc-knowledge/.../clip/service/ClipService` | 复用 `list(status=pending, pageSize=3)` + 计数（已有） |
| `vc-chat/.../service/ChatService` | 加 `listRecentConversations(n)`（若现有查询可直接复用则不改） |

### 前端

| 文件 | 动作 |
|---|---|
| `src/pages/Home/index.tsx` | 加视图状态与切换；书签逻辑原样外提 |
| `src/pages/Home/today/*` | 新增 7 个组件 + `today.css` |
| `src/pages/Home/HomeDock.tsx`、`HomeSidebar.tsx` | 不动（两视图共用） |
| `src/api/workbench.ts` | 新增 `getWorkbenchOverview` / `getBriefing`（mock 先行，按契约切换） |
| `src/hooks/useWorkbenchOverview.ts` | 新增：缓存 + 静默刷新 + 失败保留旧值 |
| `src/types/index.ts` | 新增 `WorkbenchOverview` 等类型 |
| `src/App.tsx` | `/home` 路由不变；`RootLayout` 承接 clip 轮询 |
| `src/layouts/MainLayout.tsx` | 移除自带轮询（改为消费全局 store） |

### 文档

- `PROJECT_MEMORY.md` §7.5、`openspec/api-spec.md`、`VeythCog-V/docs/frontend-style-guide.md` 同步「今日视图」条目。

## 验收总则（每条都可演示）

启动前后端 → 登录 → 进入 `/home`：

1. 默认落在「今日」：问候语随时段变化（早/午/晚），日期与星期正确；壁纸、时钟、搜索框、Dock 均与改造前一致。
2. 待办条显示两项真实数字（未处理剪藏 N、待向量化文档 M）；点「未处理剪藏」跳 `/inbox` 且状态筛选为 pending；点「待向量化」跳 `/knowledge`。
3. 「最近更新文档」按 `updated_at` 倒序取 5 条，显示标题、摘要截断、目录路径（根级显示「/」）、未向量化标记；点击直接打开该文档。
4. 「未读剪藏」显示 3 条标题 + 站点；点击跳 `/inbox` 对应条目。
5. 「最近对话」显示 3 条标题 + 模型名 + 相对时间；点击恢复该会话。
6. 切到「导航」视图，书签墙分类、滚动位置、搜索状态与改造前完全一致；再切回「今日」，数据不重新拉取（60s 内）。
7. 刷新页面：视图偏好保持上次选择（`user_setting.home_view`）；切换时另一视图内容不销毁、不闪白。
8. 断开后端：页面仍展示上次缓存数据 + 顶部轻提示；不出现整页错误页；「导航」视图完全不受影响。
9. 空库账号：三项分别显示空态文案与引导按钮，无 `undefined` / `NaN` / 空卡片。
10. 移动端（≤768px）：单列，待办在最上，卡片不横向溢出。
11. 质量门：后端 `mvn -pl vc-app -am compile` 通过；前端 `npm run build`（tsc + vite）通过；`/api/doc.html` 手测 `GET /workbench/overview` 返回结构与本 design 一致。

## 待确认（review 逐条拍板，括号内为推荐）

1. **入口形态**：`/home` 内 pill 切换（推荐，第一屏即价值、不新增路由）/ 独立 `/workbench` 路由 + rail 入口（首页仍是书签墙，问题没解决）/ 首页顶部状态条点击进独立页（两页语义重复）。
2. **默认视图**：默认「今日」（推荐，符合"打开就想用"）/ 默认仍是「导航」，需手动切（更保守）。
3. **待办口径**：只做「未处理剪藏 + 待向量化文档」两项（推荐，都有真实数据、都能直达）；是否补第三项「未校验模型」需后端在 `/llm/models` 补 `isValid` 字段（当前 `LlmModelItem` 无此字段），暂不做。
4. **AI 晨报**：本轮做「每日一句速览」+ 内存缓存 + 失败静默隐藏（推荐，成本一天一次）；或整体延后到 P2（考虑当前 DashScope 额度阻塞，不影响主体交付）。
5. **聚合 vs 分散请求**：一个新聚合接口（推荐，首屏 1 个请求、后端可并行 + 统一降级）/ 前端并发 4 个已有接口（改动更小，但首屏瀑布和降级逻辑难统一）。
6. **偏好存储**：`user_setting.home_view`（推荐，跨设备一致，符合 022 表"加列不加表"约定）/ `localStorage`（零后端改动，但换设备丢失）。
7. **最近对话条数**：3 条（推荐）/ 5 条（卡片更高，挤压下方快捷动作）。
</content>
