# Spec · 首页今日视图与聚合接口

> 变更：`p1-unified-workbench` / 2026-11-19
> 说明：本文件描述**行为与验收**，实现细节见 `../design.md` §2.1 / §3.2 / §4。

## 能力范围

`/home` 提供「今日 / 导航」双视图；今日视图的数据由单一聚合接口 `GET /workbench/overview` 提供；视图偏好按用户持久化。

## 行为契约

### W1 视图与偏好

- `/home` 默认视图由 `user_setting.home_view` 决定；字段缺失或非法值一律按 `today` 处理。
- 切换视图：`PUT /user/setting { homeView }`，乐观更新，失败回滚并提示一次。
- 切换不销毁非活跃视图：书签墙的滚动位置、当前分类、搜索关键词在切回时保持原样。
- 键盘 `1` / `2` 可切换；焦点在 `input/textarea/[contenteditable]`、右键菜单打开、拖拽进行中时忽略快捷键。

### W2 聚合接口

- `GET /workbench/overview` 一次返回 `stats / tasks / todos / recentDocs / unreadClips / recentConversations / generatedAt / partial`。
- 内部并行，总耗时上限 800ms；单项失败：该字段为空集 + `partial=true`，**HTTP 仍 200、bizCode 0**。
- 全部失败：仍返回 200 + 全空 + `partial=true`（前端展示空态与轻提示），不得返回 500 导致首页白屏。
- 空库：全部数组为空、`stats` 全 0、`partial=false`。
- 条数：`recentDocs` ≤ 5、`unreadClips` ≤ 3、`recentConversations` ≤ 3、`todos` ≤ 4。
- `tasks` 只含 `count > 0` 的派生待处理项，`count=0` 的项不返回。

### W3 缓存与刷新

- 前端进入页面：`sessionStorage` 缓存 < 60s 直接渲染且不请求；60s-5min 先渲染缓存再后台刷新；>5min 或首次进入直接请求。
- 刷新不得清空已展示内容（无感规范）：先展示旧值，数据到达后原地替换，右上角细进度条。
- 请求失败：有旧值 → 保留旧值 + 顶部 2s 轻提示；无旧值 → 空态，不出现错误页。

### W4 跳转意图

- 今日视图产生的跳转必须带定位参数，且目标页消费后清理 URL：
  - `/inbox?status=pending` → Inbox 预设筛选
  - `/knowledge?doc=<id>` → 打开指定文档
  - `/knowledge?filter=unvectorized` → 知识库筛选未向量化（若该能力尚未实现，退化为进入知识库首页，不报错）
  - `/chat?c=<id>` → 选中指定会话
- 参数解析集中在 `utils/queryIntent.ts`，读取一次后 `history.replaceState` 清除，避免刷新重复触发。

### W5 角标轮询

- clip 待处理角标轮询从 `MainLayout` 上移到 `RootLayout`：进站一次 + 每 60s 一次，全站唯一实例。
- `/home` 与内页读同一个 `clipStore.pendingCount`；不得出现两套定时器或两套数值。

## 验收标准

1. 首屏默认「今日」，壁纸/时钟/搜索/Dock 与改造前一致；`/home` 顶部出现「今日 / 导航」pill。
2. 聚合接口在 `doc.html` 返回结构与 design §2.1 一致；断一项（如临时让剪藏查询抛错）时 `partial=true` 且页面可用。
3. 今日视图 6 个区块全部有数据或空态文案，无 `undefined`/`NaN`/空白卡片。
4. 切到「导航」：分类网格正常，滚轮切分类、右键菜单、拖拽全部可用。
5. 切回「今日」：数据不重新请求（Network 60s 内无第二次 `/workbench/overview`）。
6. 刷新页面：视图偏好保持；今日数据从 sessionStorage 秒出。
7. 断开后端：页面保留旧数据 + 轻提示；无白屏、无 uncaught error。
8. `/home` 收件箱角标与 `/inbox` 内数值一致（轮询上移生效）。
9. `prefers-reduced-motion` 下切换视图无动画但功能完整。

## 测试场景

| 场景 | 步骤 | 期望 |
|---|---|---|
| 首屏冷启动 | 清 sessionStorage 后进 `/home` | 壁纸时钟先出，卡片后到；无整页 loading |
| 快速来回切 | 1/2 键连续切换 10 次 | 无闪烁、无重复请求、滚动位置保留 |
| 焦点保护 | 光标在搜索框按 `1` | 输入 "1"，不切视图 |
| 单项降级 | 让 clip 服务异常 | 剪藏块空态，其余正常，顶部轻提示 |
| 越权参数 | `?doc=999999` | 打开失败提示，不崩页 |
| 偏好非法值 | DB 改 `home_view='xx'` | 按 today 处理，不报错 |
