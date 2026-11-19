# Design · P1 统一工作台（首页「今日」视图）

> 版本：v1.0（2026-11-19）
> 前置 review：本文件与 `proposal.md` 同时评审，通过后才写 `specs/` 与 `tasks.md`

## 0. 现状与硬约束（读代码得出，不是猜的）

| 事实 | 出处 | 对设计的影响 |
|---|---|---|
| `/home` 是挂在 `MainLayout` **之外**的独立路由 | `App.tsx` L165-172 | 首页没有 rail 的角标轮询；工作台必须在 `/home` 内自行取数 |
| `clipPending` 轮询写在 `MainLayout` L31-35（进站一次 + 60s） | `layouts/MainLayout.tsx` | 轮询需上移到 `RootLayout`，否则两处各跑一套定时器 |
| `NAV_ITEMS` 只有 chat/knowledge/inbox/music/tools，**不含 home** | `config/navItems.ts` L33-39 | 首页入口靠 rail 顶部 Logo 与 `navigate('/home')`；本 change 不改入口清单 |
| Home 页 17.6KB，内含书签网格、分类栏、右键菜单、拖拽、搜索、Dock、时钟、格言 | `pages/Home/index.tsx` | 新增内容必须外提到 `today/`，禁止继续堆在 index.tsx |
| 已存在接口：`/clip/pending-count`、`/clip/list`、`/knowledge/list`（含 `isVectorized`）、`/chat/conversations`、`/nav/bootstrap`、`/user/setting` GET+PUT | `src/api/*.ts`、`UserSettingController` | 聚合接口只做编排，不重写业务逻辑 |
| `user_setting` 是「一人一行、加列不加表」 | `022_user_setting.sql` 头注释 | 视图偏好用加列，不新建表 |
| 剪藏状态机 `pending / archived / dropped` | `ClipService` L45-47 | 待办口径 = `status='pending'` |
| `DocListItem` 已带 `isVectorized` | `src/types/index.ts` | 最近文档可直接展示向量化状态 |
| 前端已有细进度条组件 `PageLoadingBar`（支持 `docked`） | `App.tsx` L205、`MainLayout` L148 | 静默刷新复用它，不自造加载态 |
| 动效令牌集中在 `global.css` / `page.css`（`--motion-*` / `--sheen-*`） | `agent.md` §7 | 新组件只用令牌，不写魔法值 |

## 1. 数据模型

### 1.1 DDL（`VeythCog-C/docs/sql/025_user_setting_home_view.sql`，幂等）

```sql
ALTER TABLE user_setting
    ADD COLUMN IF NOT EXISTS home_view VARCHAR(16) NOT NULL DEFAULT 'today';

COMMENT ON COLUMN user_setting.home_view IS '首页默认视图：today / nav（服务层白名单校验，非法值回落 today）';
```

- 不需要索引（一人一行，主键查询）。
- 存量用户默认 `today`：符合"第一屏有用"的目标；用户可随时切回「导航」。
- 回滚：`ALTER TABLE user_setting DROP COLUMN IF EXISTS home_view;`（前端对字段缺失按 `today` 兜底）。

### 1.2 派生待办的 SQL 口径

| 待办 | 口径 | 来源 |
|---|---|---|
| 未处理剪藏 | `SELECT count(*) FROM clip_item WHERE status='pending' AND deleted=false`（如无 `deleted` 列则忽略该条件） | `clip_item` |
| 待向量化文档 | `SELECT count(*) FROM knowledge_doc WHERE deleted=false AND is_vectorized=false AND length(markdown_text) >= 200` | `knowledge_doc` |

**为什么加 200 字门槛**：`is_vectorized` 默认 `false`，新建空文档也计入，会把待办数字撑到几十条，失去引导意义。200 字以下视为草稿，不催促向量化（阈值写成常量 `WorkbenchService.MIN_VECTORIZE_CHARS`，后续可调）。

**明确不做**：书签缺图标（`nav_bookmark` 现仅 2 条无图，价值太低）、未校验模型（`LlmModelItem` 无 `isValid` 字段，需要改 `/llm/models`，超出范围）。

## 2. API 契约（context-path `/api`，统一 `BaseResponse<T>`，HTTP 恒 200 + bizCode）

### 2.1 `GET /workbench/overview`

无请求参数（用户由 JWT 解析）。

响应 `WorkbenchOverview`：

```java
@Data
public class WorkbenchOverview {
    private long generatedAt;          // 服务端时间戳（ms），前端用于"x 分钟前"
    private boolean partial;           // 任一子查询降级为 true，前端顶部轻提示
    private Stats stats;
    private List<TaskItem> tasks;
    private List<RecentDoc> recentDocs;
    private List<UnreadClip> unreadClips;
    private List<RecentConversation> recentConversations;
}

@Data
public class Stats {
    private long unreadClips;          // 待处理剪藏
    private long pendingVectorDocs;    // 待向量化文档（≥200 字）
    private long totalDocs;            // 未删除文档总数
    private long totalBookmarks;       // 书签总数
    private long totalConversations;   // 会话总数（软删除除外）
}

@Data
public class TaskItem {
    private String key;                // "clip" / "vectorize"
    private String label;              // "3 条剪藏待处理"
    private long count;
    private String href;               // "/inbox?status=pending" / "/knowledge?filter=unvectorized"
    private String tone;               // "warn" / "info"（仅决定圆点颜色，不决定整卡配色）
}

@Data
public class RecentDoc {
    private long id;
    private String title;
    private String summary;            // 截断到 60 字，前端二次省略
    private Long folderId;             // null = 根级
    private String folderPath;         // "技术/中间件"；根级为 "/"
    private boolean isVectorized;
    private long updatedAt;            // ms
}

@Data
public class UnreadClip {
    private long id;
    private String title;
    private String site;
    private String url;
    private long createdAt;
}

@Data
public class RecentConversation {
    private String id;                 // chat_session id（字符串形态，沿用现有会话标识）
    private String title;
    private String modelName;
    private int messageCount;
    private long updatedAt;
}
```

**契约要点**

- `tasks` 恒返回 0-2 项：`count == 0` 的项**不返回**（前端不渲染空 chip），全为 0 时返回空数组，由前端渲染"今天没有待处理"。
- `recentDocs` 最多 5 条，`recentConversations` / `unreadClips` 最多 3 条（见 proposal 待确认 7）。
- 所有 `*At` 字段为 epoch millis（与现有 `DocListItem.updatedAt` 口径一致，前端不再换算）。
- 空库：全部数组为空、`stats` 全 0、`partial=false`，**不是错误**。

### 2.2 可选 `POST /workbench/briefing`

请求：空 body。响应：

```java
@Data
public class BriefingResult {
    private String text;        // ≤80 字；模型不可用/生成失败时为 null
    private String generatedAt; // yyyy-MM-dd
    private boolean cached;     // 是否命中当日缓存
}
```

- 缓存键 `userId + yyyy-MM-dd`，`ConcurrentHashMap` + 当日过期（重启丢失可接受，不落库）。
- 输入：最近 3 篇文档的标题+摘要、未读剪藏标题、最近 3 个会话标题；输出一句中文概述。
- **降级**：无可用模型 / Key 未校验 / 调用超时（3s）→ 返回 `text=null`，前端不渲染该卡（不显示"生成失败"）。当前 DashScope 额度阻塞不影响主体交付。

### 2.3 `PUT /user/setting` 扩展

`UserSettingPatch` 增加 `homeView`（`today|nav`，非法值忽略并保持原值）；`UserSettingView` 增加同名字段。前端切换视图时**乐观更新**：先切 UI，再 `PUT`；失败静默回滚到上次值。

## 3. 后端设计

### 3.1 类清单

| 文件 | 说明 |
|---|---|
| `vc-app/web/WorkbenchController.java` | `GET /workbench/overview`、`POST /workbench/briefing` |
| `vc-app/workbench/WorkbenchService.java` | 编排 + 并行 + 降级 |
| `vc-app/workbench/WorkbenchProperties.java` | `workbench.fetch-timeout-ms=800`、`workbench.briefing-timeout-ms=3000`、`workbench.min-vectorize-chars=200` |
| `vc-app/workbench/config/WorkbenchExecutorConfig.java` | `ThreadPoolTaskExecutor`（core=4, max=4, queue=32, 拒绝策略 CallerRunsPolicy） |
| `vc-app/workbench/dto/*.java` | 上述 6 个 DTO |
| `vc-knowledge/service/KnowledgeService(+Impl)` | 加 `countPendingVector(minChars)`、`listRecent(int limit)` |
| `vc-knowledge/mapper/KnowledgeDocMapper(+XML)` | 加两条只读 SQL（`countPendingVector`、`selectRecent`） |
| `vc-chat/service/ChatService` | 加 `listRecentConversations(limit)`（抽现有 `ChatController` 查询逻辑，不复制） |

> 依赖方向校对：`vc-app` 已依赖 `vc-chat` / `vc-knowledge`（`ChatController`、`KnowledgeController` 都在 vc-app），聚合层放 vc-app 不引入新依赖。

### 3.2 并行与降级（核心实现）

```java
CompletableFuture<Stats>            f1 = async(() -> stats());
CompletableFuture<List<TaskItem>>   f2 = async(() -> tasks());     // 依赖 f1 的计数，合并到一次
CompletableFuture<List<RecentDoc>>  f3 = async(() -> recentDocs());
CompletableFuture<List<UnreadClip>> f4 = async(() -> unreadClips());
CompletableFuture<List<RecentConv>> f5 = async(() -> recentConversations());
CompletableFuture.allOf(f1, f3, f4, f5).orTimeout(800, MILLISECONDS).join();
```

- 每个 future 包 `exceptionally(ex -> { partial = true; return empty; })`，用 `AtomicBoolean` 汇总 `partial`。
- `orTimeout` 到点后 `join` 不会抛到上层：未完成的 future 用 `getNow(emptyValue)` 取空值，保证接口有界响应（P95 目标 **< 300ms**，超时上限 800ms）。
- 禁止直接 `join` 无限等待；禁止在 controller 里串行调 5 个 service。

### 3.3 关键 SQL

```xml
<!-- countPendingVector -->
SELECT count(*) FROM knowledge_doc
 WHERE deleted = false
   AND is_vectorized = false
   AND length(markdown_text) >= #{minChars}

<!-- selectRecent -->
SELECT id, title, summary, folder_id, is_vectorized, updated_at
  FROM knowledge_doc
 WHERE deleted = false
 ORDER BY updated_at DESC
 LIMIT #{limit}
```

- `folderPath` 不在 SQL 里递归：调用 `KnowledgeFolderService` 一次性取全部目录（现有 `tree()` 已返回完整 `folders`），Java 侧对 5 个 `folderId` 逐级上溯拼路径，**不引入递归 CTE**。
- `totalBookmarks` 走 `NavBookmarkService.count()`（MyBatis-Plus 自带 `count`，无新方法）。
- `totalConversations` 走现有会话查询的 count（软删除条件与 `ChatController` 一致）。

### 3.4 错误码

| 场景 | bizCode | 提示 |
|---|---|---|
| 未登录 | 沿用 40100 | 跳登录（前端拦截器已处理） |
| 全部子查询失败 | 20000 + `partial=true` + 全空 | "部分数据加载失败，稍后重试" |
| 未知异常 | 50000 | 通用错误提示 |

## 4. 前端设计

### 4.1 组件与目录

```
pages/Home/
├── index.tsx              // 只保留：视图状态、书签墙原逻辑、切换 pill
├── today/
│   ├── TodayView.tsx      // 12 栅格布局容器
│   ├── TaskStrip.tsx      // 待办条（chips）
│   ├── RecentDocs.tsx
│   ├── UnreadClips.tsx
│   ├── RecentChats.tsx
│   ├── QuickActions.tsx   // 新建文档 / 新对话 / 打开收件箱 / 全局搜索
│   ├── Greeting.tsx       // 问候 + 日期 + 轻统计
│   ├── Briefing.tsx       // 可选，text 为 null 时整卡不渲染
│   └── today.css
```

### 4.2 视图切换（不销毁、不闪）

- 两个视图**常驻挂载**，非活跃层 `visibility: hidden; opacity: 0; pointer-events: none`，容器用 `--motion-duration-slow` 过渡 `opacity`（只列具体属性，禁止 `transition: all`）。
- 书签墙本身按分类渲染（非全量 267 条），常驻成本可控；保留各自滚动位置（`scrollTop` 存 ref，恢复时 `scrollTo` 无动画）。
- 切换入口：时钟下方 pill（`.vc-seg`），当前态用 `--color-accent` 描边；键盘 `1/2` 切换，**焦点在搜索框 / 右键菜单 / 拖拽中时忽略**。
- 首次进入读 `user_setting.homeView`（缺省 `today`）；切换后乐观 `PUT`，失败回滚并提示一次。

### 4.3 取数 hook（`useWorkbenchOverview`）

```
进页
  ├─ sessionStorage 有缓存且 <5min → 先用缓存渲染（不显示 loading），60s 内不重复请求
  ├─ 否则并发 GET /workbench/overview（同时保留 localStorage 的 lastGood 副本）
  ├─ 成功 → 更新视图 + sessionStorage + 进度条 600ms 最小显示后收起
  └─ 失败 → 保留旧内容，顶部 2s 轻提示"数据可能不是最新"；无旧值时显示空态
```

- 刷新触发：进页一次、点击右上角刷新按钮、从其他页面返回（`location.key` 变化且距上次 > 60s）。
- 不做定时轮询（首页不需要秒级新鲜度；角标仍走全局 60s 轮询）。

### 4.4 布局与视觉

- 容器：`.vc-home__content` 内新增 `.vc-today`，`display:grid; grid-template-columns: 1fr 340px; gap:16px`；≤1024px 变单列，待办条置顶。
- 卡片：复用 `.vc-card` 玻璃底 + `--radius-lg` + `--shadow-md`；**不开流光**（今日页信息密度高，扫光=噪声，按 `agent.md` §7 只在交互卡用）。
- 分类色只用于 6px 圆点（文档目录、剪藏站点）；正文/标题/数值全部用主题文本色，保持黑白基调。
- 标题层：`TodayView` 顶部一句问候（`--font-display`，24px），右侧日期（次级色，13px）；不做大插画、不做渐变横幅。
- 待办 chip：胶囊形，`--surface-2` 底，左侧 6px 圆点（`warn` = 琥珀，`info` = 科技蓝），hover 抬 1px。
- 数字统一 `tabular-nums`，避免刷新时宽度跳动。

### 4.5 交互细节

| 区域 | 行为 |
|---|---|
| 待办 chip | 点击 `navigate(href)`；`href` 带 query，目标页需支持（Inbox 读 `status`、Knowledge 读 `filter`） |
| 最近文档行 | 点击 `navigate('/knowledge?doc=id')`；新增文档参数支持（Knowledge 页读取并打开） |
| 未读剪藏 | 点击进 `/inbox` 并定位条目（`?item=id`） |
| 最近对话 | 点击 `navigate('/chat?c=id')`（Chat 已有 `prefill` 参数，新增 `c` 只做选中） |
| 快捷动作 | 新建文档 / 新建对话 / 打开收件箱 / 打开命令面板（`veythcog:open-palette`） |

> 三个 query 参数（`doc`、`item`、`c`）属于**轻量兼容改动**：目标页只在 `useEffect` 里读取一次并清理 URL 参数，不影响原有交互。
> 与 `p1-knowledge-map` 的 `?docs=` 共用同一份解析工具 `src/utils/queryIntent.ts`（`takeQueryIntent()`：读取 → 清参数 → 返回结构化意图），两个 change 同批 apply 时先落地它。

### 4.6 无数据 / 局部失败

| 状态 | 表现 |
|---|---|
| 全空（新账号） | 问候 + "从这开始：新建第一篇文档 / 试试网页剪藏" 两个大按钮 |
| 有待办无文档 | 待办条 + "还没有文档，读完剪藏可以一键入库" |
| `partial=true` | 顶部一条 28px 高的细提示条（非弹窗），文案"部分数据暂时取不到，其余照常" |
| 后端 401 | 全局拦截器已跳登录，本页不额外处理 |

## 5. 兼容与迁移

- 老用户：`home_view` 默认 `today`；若用户关闭新视图不提供开关（不做"隐藏工作台"选项，避免两套逻辑）。
- `/home` 原有键盘/右键/拖拽/搜索逻辑不动；切换视图时若有右键菜单打开则先关闭。
- 移动端：`clipPending` 轮询上移后仍 60s 一次，与现状一致。
- 回滚路径：删除 `today/` 目录 + `Home/index.tsx` 恢复单视图 + DDL 保留（不删列也不影响老代码）。

## 6. 性能与验证点（apply 时必须逐条过）

1. `/workbench/overview` 本地实测 P95 < 300ms（库在腾讯云，需在真实网络下测；若超，先查 `knowledge_doc` 全表 count 是否缺索引）。
2. 首页首屏：壁纸/时钟先出，今日卡片后到，**不出现整页 loading 顶掉壁纸**。
3. 两视图往返 10 次：无内存泄漏（DevTools Memory 快照对比）、无重复请求（Network 无重复 `/workbench/overview`）。
4. 断开后端 → 有旧值展示旧值、无旧值展示空态，均无白屏/报错页。
5. 视图切换动画在 `prefers-reduced-motion: reduce` 下立即完成，功能等价。
6. `npx tsc --noEmit` exit 0；`npm run build` 通过。
7. `/workbench/overview` 在 `doc.html` 上返回结构与 §2.1 完全一致（字段名、类型、空数组语义）。

## 7. 工作量估算

| 项 | 人日 |
|---|---|
| 后端聚合接口 + 两个只读方法 + DDL | 1.5 |
| 前端 today/ 七组件 + 布局 + 视觉 | 2.0 |
| 视图切换 / 缓存 hook / 轮询上移 / 三个 query 参数 | 1.0 |
| 晨报（可选） | 0.5 |
| 联调 + 质量门 + 文档同步 | 1.0 |
| **合计** | **6.0**（不含晨报 5.5） |

> 排期约束：`agent.md` §3 要求单阶段 ≤3 周；本 change 6 人日，可与 `p1-knowledge-map` 并行（后者仅依赖 `/knowledge` 页，互不改同一文件，除 `Knowledge/index.tsx` 需协调一次合并）。
</content>
