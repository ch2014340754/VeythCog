# Proposal · P1 统一工作台（首页「今日」视图 + 待办）

> 版本：v1.1（2026-11-19，纳入自定义待办）
> 状态：review 通过，进入 apply
> 关联：`agent.md` §2 流程、`PROJECT_MEMORY.md` §7（前端架构）、`openspec/changes/p1-nav-homepage/design.md`（首页现状）

## 为什么做（Why）

首页 `/home` 目前是 iTab 风格书签墙（壁纸 + 时钟 + 搜索 + 分类网格 + Dock），视觉完整但**信息上是静态的**：

- 打开首页看到的是一排固定入口，没有「今天该干什么 / 有什么变化」；
- 系统里已有 5 类真实数据——知识库文档、未处理剪藏、对话会话、导航书签、音乐——但**没有一处把它们聚合**，用户要逐个页面点进去才知道有什么新东西；
- `clipPending` 角标只在 `MainLayout` 每 60s 轮询（`layouts/MainLayout.tsx` L31-35），而 `/home` 是挂在 `MainLayout` **之外**的独立路由（`App.tsx` L165-172），**首页反而看不到收件箱角标**——真实存在的信息盲区；
- 系统**没有任何「个人待办」的载体**：`Admin/Tasks` 是运维 mock，Navigation 分类是"收藏类型"，都不能承载"明天要补的文档""周末整理剪藏"这类事。

结论：缺的不是页面，是「第一屏有用」+「能记事」。本轮把已有数据聚合为「今日」视图，并新增最小可用的自定义待办（表 + 全套 CRUD + 独立页），书签墙原样保留。

## 做什么（What）

一句话：**`/home` 内新增可切换的「今日」视图（默认进入），由后端聚合接口带回待办、最近文档、未读剪藏、最近对话与统计；新增 `todo_item` 表与 `/todo` 页面，支持自定义待办；原书签墙作为「导航」视图原样保留。**

### 后端

1. **待办模块**（`vc-user` 的 `com.vc.user.todo`，复用 vc-user 已有的 MyBatis-Plus + PostgreSQL 依赖，不新建 Maven 模块）：
   - `026_todo_item.sql`：`todo_item` 表（用户级、软删除、状态 `open/done`、优先级 `0/1/2`、可选截止日与关联链接）；
   - `GET /todo/items`（分页 + `status/keyword` 过滤）、`POST /todo/items`、`PUT /todo/items/{id}`（局部更新）、`POST /todo/items/{id}/toggle`、`DELETE /todo/items/{id}`；
   - `@MapperScan` 增补 `com.vc.user.todo`（启动类 `VcAppApplication`）。
2. **聚合接口** `GET /workbench/overview`：并行调用已有服务（`TodoService` / `KnowledgeService` / `ClipService` / `ChatService` / `NavBookmarkService`），**不新增业务表**；单项失败降级为空集并置 `partial=true`。
3. **派生待处理**（真实数据算出来，不是 mock）：
   - 未处理剪藏：`clip_item.status = 'pending'` 计数；
   - 待向量化文档：`is_vectorized = false` 且正文 ≥ 200 字的文档数（过滤空白草稿）。
4. `user_setting` 增加 `home_view`（`today` / `nav`），复用 `GET/PUT /user/setting`。
5. 可选 `POST /workbench/briefing`：一句「今日速览」，当日缓存 + 失败静默降级。

### 前端

1. `pages/Home` 拆出 `today/` 子目录：`TodayView` / `TaskCard`（我的待办 + 待处理）/ `RecentDocs` / `UnreadClips` / `RecentChats` / `QuickActions` / `StatLine` / `homeToday.css`，`Home/index.tsx` 只负责视图切换与原书签逻辑。
2. 新增 `pages/Todo/index.tsx`：全屏列表（`useInfiniteRows` + `ListSentinel`，不分页）、筛选（全部/未完成/已完成 + 关键词）、新增/编辑弹窗、勾选完成、删除；`NAV_ITEMS` 增补「待办」入口。
3. 视图切换：时钟下方分段 pill「今日 / 导航」，键盘 `1/2` 可切；切换不销毁另一视图的滚动位置与分类选中态。
4. 数据走 `useWorkbenchOverview`：进页拉取 → `sessionStorage` 5 分钟缓存先渲染旧值 → 后台静默刷新 → 右上角细进度条（复用 `PageLoadingBar` docked），不闪、不整块 Spin。
5. 角标轮询上移：`MainLayout` 的 clip 轮询提升到 `RootLayout`，首页与内页共用一份。

## 范围（Scope）

### In-scope

| 能力 | 说明 |
|---|---|
| 自定义待办 | 表 + CRUD + 独立 `/todo` 页（列表/筛选/新增/编辑/完成/删除） |
| 今日视图 | 问候 + 日期、我的待办（前 4 条 + 内联新增）、待处理 chips、最近更新文档、未读剪藏、最近对话、轻统计 |
| 视图切换 | 今日 / 导航 pill，偏好持久化到 `user_setting.home_view` |
| 聚合接口 | 一次请求返回上述全部数据，内部并行 + 超时 + 降级 |
| 派生待处理 | 未处理剪藏、待向量化文档；点击直达对应页面并带上筛选 |
| 无感刷新 | 保留旧内容 + 细进度条；切回首页 60s 内不重复拉取 |
| 空态 | 无待办 / 无文档 / 新账号三种空态文案与引导动作 |
| 移动端 | 单列布局，待办置顶 |

### Out-of-scope

- ❌ 重复任务（每日/每周循环）、提醒推送（站内/邮件/飞书）、到期通知；
- ❌ 子任务 / 清单嵌套 / 任务依赖；
- ❌ 拖拽排序（v1 按「截止日 → 优先级 → 创建时间」固定排序，`sort_order` 列预留但不启用）；
- ❌ 与飞书任务/日历双向同步；
- ❌ 日历视图、甘特图、图表化统计大屏；
- ❌ 消息通知中心 / 未读红点体系（角标沿用现有 clip 机制）；
- ❌ 首页可拖拽自定义布局；
- ❌ 定时任务引擎（`Admin/Tasks` 仍为 mock）；
- ❌ 修改 `/home` 现有书签/壁纸/分类/Dock 的任何交互。

## 影响面

### 数据库

- `026_todo_item.sql`：新建 `todo_item`（**带 `user_id`**——待办天然属于个人，与 §10.1「知识库全账号共享」的历史决策不冲突）；
- `025_user_setting_home_view.sql`：`user_setting` 加列 `home_view`；
- 无其它表变更。

### 后端

| 文件 | 动作 |
|---|---|
| `VeythCog-C/docs/sql/025_user_setting_home_view.sql`、`026_todo_item.sql` | 新增 |
| `vc-user/.../todo/{TodoItem, TodoMapper, TodoService, dto/*}.java` | 新增（entity / mapper / service / DTO） |
| `vc-user/.../todo/resources/mapper/TodoItemMapper.xml` | 新增（自定义分页与筛选 SQL） |
| `vc-app/.../web/TodoController.java` | 新增（5 个接口） |
| `vc-app/.../web/WorkbenchController.java` + `workbench/WorkbenchService` + DTO | 新增 |
| `vc-app/.../web/UserSettingController.java`、`UserSettingView/Patch` | 加 `homeView` |
| `vc-app/.../VcAppApplication.java` | `@MapperScan` 加 `com.vc.user.todo` |
| `vc-knowledge/.../KnowledgeService` | 加 `countPendingVector()`、`listRecent(n)` |
| `vc-chat/.../ChatService` | 加 `listRecentConversations(n)` |

### 前端

| 文件 | 动作 |
|---|---|
| `src/pages/Home/index.tsx` | 加视图状态与切换；书签逻辑保持不变 |
| `src/pages/Home/today/*` | 新增 7 个组件 + `homeToday.css` |
| `src/pages/Todo/index.tsx` + `todo.css` | 新增 |
| `src/api/workbench.ts`、`src/api/todo.ts` | 新增 |
| `src/hooks/useWorkbenchOverview.ts` | 新增：缓存 + 静默刷新 + 失败保留旧值 |
| `src/types/index.ts` | 新增 `WorkbenchOverview`、`TodoItem` 等类型 |
| `src/config/navItems.ts` | 增补「待办」入口（`/todo`） |
| `src/App.tsx` | `/todo` 路由；`RootLayout` 承接 clip 轮询 |
| `src/layouts/MainLayout.tsx` | 移除自带轮询 |
| `src/pages/Knowledge/index.tsx`、`src/pages/Chat/index.tsx` | 读取 `doc` / `c` query 参数（与 p1-knowledge-map 共用 `utils/queryIntent.ts`） |

### 文档

- `PROJECT_MEMORY.md` §5（数据模型）、§6（接口）、§7.5、`openspec/api-spec.md`、`VeythCog-V/docs/frontend-style-guide.md` 同步。

## 验收总则（每条都可演示）

启动前后端 → 登录 → 进入 `/home`：

1. 默认落在「今日」：问候语随时段变化，日期与星期正确；壁纸、时钟、搜索框、Dock 与改造前一致。
2. 「我的待办」空态显示输入框；输入标题回车 → 待办出现在列表、`/todo` 页同步可见；刷新后仍在。
3. 勾选待办 → 划掉并移到已完成；再勾一次 → 恢复未完成。`completed_at` 正确写入。
4. 待办编辑：改标题、优先级、截止日、备注、关联链接均生效；`/todo` 页筛选「未完成/已完成/全部」与关键词搜索正确。
5. 删除待办 → 列表消失，`/todo` 同步消失（软删除，DB 行仍在且 `deleted=true`）。
6. 待处理条显示两项真实数字（未处理剪藏 N、待向量化文档 M）；点「未处理剪藏」跳 `/inbox` 且状态筛选 pending；点「待向量化」跳 `/knowledge`。
7. 「最近更新文档」按 `updated_at` 倒序取 5 条，显示标题、摘要、目录路径、未向量化标记；点击直接打开该文档。
8. 「未读剪藏」「最近对话」各 3 条，点击跳转正确页面并定位。
9. 切到「导航」视图，书签墙分类、滚动位置、搜索状态与改造前完全一致；切回「今日」60s 内不重复请求。
10. 刷新页面：视图偏好保持（`user_setting.home_view`）；切换时另一视图不销毁、不闪白。
11. 断开后端：展示上次缓存数据 + 轻提示；「导航」视图完全不受影响。
12. 空库账号：三项空态文案与引导按钮正常，无 `undefined` / `NaN`。
13. 移动端（≤768px）：单列，待办在最上，不横向溢出。
14. 质量门：后端 `mvn -pl vc-app -am compile` 通过；前端 `npm run build` 通过；`doc.html` 手测 `/workbench/overview` 与 `/todo/items` 结构与 design 一致。

## 决策记录（已确认）

1. **入口形态**：`/home` 内 pill 切换（第一屏即价值、不新增路由）。
2. **默认视图**：`today`（可切回 `nav`）。
3. **待办**：建 `todo_item` 表，做全套 CRUD，**不做提醒/重复/子任务**（本轮范围）。
4. **AI 晨报**：本轮不做。理由：当前 DashScope Key 校验阻塞，且待办模块本身已提供足够的「今日感」；待 Key 恢复后作为 P2 单独加，接口预留 `POST /workbench/briefing`。
5. **聚合 vs 分散请求**：一个聚合接口（首屏 1 个请求、后端并行 + 统一降级）。
6. **偏好存储**：`user_setting.home_view`。
7. **待办归属**：带 `user_id`，按登录用户隔离（待办是私人数据，与知识库共享策略不同）。
