# Tasks · P1 统一工作台（今日视图 + 待办）

> 状态：apply 完成（2026-11-19），运行时验证已过；仅剩 UI 目测与文档同步
> 规则：一项完成并验证后再进入下一项（`agent.md` §2.3）

## A. 数据库

- [x] A1 新增 `docs/sql/025_user_setting_home_view.sql`（`home_view` 列，幂等）
- [x] A2 新增 `docs/sql/026_todo_item.sql`（建表 + `idx_todo_user_status` + 注释）
- [x] A3 在开发库执行 025、026（`psql 17.12`），复核列、默认值与索引；DDL 幂等（`IF NOT EXISTS`）

## B. 后端 · 待办

- [x] B1 `vc-user/.../todo/TodoItem.java`（`@TableName("todo_item")`，`completedAt` 用 `FieldStrategy.ALWAYS` 才能置空）
- [x] B2 `TodoItemMapper.java` + `vc-user/src/main/resources/mapper/TodoItemMapper.xml`（`TodoItemMap` + `Filter_Where` + CASE WHEN 排序）
- [x] B3 `dto/{TodoItemView, TodoCreateRequest, TodoPatchRequest, TodoPage}.java`（vc-user 无 PageResult，自建同构 `TodoPage`）
- [x] B4 `TodoService.java`（create/list/update/toggle/delete/openBrief/countOpen/countDueToday；`overdue` 计算；越权 404；pageSize 上限 100）
- [x] B5 `vc-app/web/TodoController.java`（`GET/POST /todo/items`、`PUT /{id}`、`POST /{id}/toggle`、`DELETE /{id}`、`GET /todo/items/open`）
- [x] B6 `VcAppApplication` 的 `@MapperScan` 增补 `com.vc.user.todo`
- [x] B7 `mvn -pl vc-app -am compile` 通过（JDK 21）

## C. 后端 · 聚合接口

- [x] C1 `KnowledgeService` + `KnowledgeDocMapper.xml`：`countPendingVector(minChars)`、`selectRecent(limit)`
- [x] C2 会话列表复用 `ChatHistoryService.listConversations(userId)`（在 `com.vc.chat` 包，取前 3 条），未复制 SQL
- [x] C3 `com.vc.app.workbench`：`WorkbenchService`（6 线程 daemon 池 + `orTimeout(800ms)` + 单任务异常降级 + `partial` 标记）、DTO、Controller
- [x] C4 `UserSetting` / `View` / `Patch` / `Service`：加 `homeView`（白名单 `today|nav`，非法值 PARAMS_ERROR）
- [x] C5 `mvn -pl vc-app -am compile` 通过；接口实测（见 F2）

## D. 前端 · 待办

- [x] D1 `api/todo.ts`（契约类型 + list/create/update/toggle/remove）；未污染全局 `types/index.ts`
- [x] D2 `pages/Todo/TodoRow.tsx`（勾选圆圈 + 标题删除线 + `describeDue` + 优先级点 p0 灰 / p1 蓝 / p2 橙 + hover 操作）
- [x] D3 `pages/Todo/index.tsx` + `TodoEditModal.tsx` + `todo.css`（筛选 pill / 300ms 防抖 / `seqRef` 丢弃过期响应 / 乐观 toggle + 失败回滚 / 骨架屏 / 空态三文案）
- [x] D4 `config/navItems.ts` 加「待办」+ `routes/lazyPages.ts` + `App.tsx` `/todo` 路由

## E. 前端 · 今日视图

- [x] E1 `api/workbench.ts` + `hooks/useWorkbenchOverview.ts`（按 userId 隔离的 sessionStorage 缓存 + 静默刷新 + 失败保留旧数据只置 error）
- [x] E2 `pages/Home/today/TodayView.tsx` + `homeToday.css`（问候语 / 日期 / 4 个数字卡 / 待办卡内联回车新增 / 最近文档·对话·待读剪藏 / 两个快捷入口）
- [x] E3 `Home/index.tsx` 双视图切换（`ViewSwitch` 胶囊 + `?view` 之外的本地偏好 `vc:home:view`）+ today 分支不渲染侧栏/QuoteBar/Dock + `handleWheel` guard
- [x] E4 深链解析**改为在各自页面内完成**（未创建 `utils/queryIntent.ts`，实测后认为公共抽取消歧收益低）：
  - `Knowledge` 读 `?docId=`、`?filter=unvectorized`、`?view=map`
  - `Chat` 读 `?c=`、`?docs=`、`?prefill=`
  - `Inbox` 默认即 `status=pending`，无需解析
- [x] E5 剪藏角标轮询统一上移到 `App.tsx` 的 `ClipBadgeSync`（token 为空不启动），`MainLayout` / `HomeSidebar` 只读 store

## F. 质量门

- [x] F1 `npx tsc --noEmit` exit 0；`npm run build` 通过（12.5s）
- [x] F2 接口实测（`java -jar` 8123，测试账号 `verify_agent_1119`）：
  - `POST /api/todo/items` → `{code:0,data:1}`；列表 total=1；toggle → `status=done` + `completedAt`；`PUT` + `clear` → 200；`DELETE` → total=0
  - `GET /api/workbench/overview` → `code=0, partial=false`，`stats.totalDocs=2` / `totalBookmarks=267` / `recentDocs=2`，`folderPath` 与 `isVectorized` 正确
  - 待人工目测：`/home` 双视图切换、`/todo` 页交互（见"未完成"）
- [ ] F3 更新 `PROJECT_MEMORY.md` / `openspec/api-spec.md` / 前端样式指南

## 未完成 / 已知项

- UI 目测未做（本轮只做接口与构建验证，未启动前端 dev server）
- `minSimilarity` 校准依赖真实向量数据，属 `p1-knowledge-map`（见该 change 的 tasks）
