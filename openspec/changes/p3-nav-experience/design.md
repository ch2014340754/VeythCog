# 导航体验增强 · 设计

## 1. 组件与文件

| 文件 | 职责 |
|---|---|
| `src/hooks/useDocumentTitle.ts` | 声明式设置 `document.title`；传 `undefined/null` 时不改动（避免父级覆盖子级） |
| `src/utils/pageTitle.ts` | `resolvePageTitle(pathname): string \| null`，静态路由 → 中文标题 |
| `src/components/CommandPalette.tsx` | 全局命令面板（Modal）+ Ctrl/Cmd+K、`/`、rail 自定义事件监听 |
| `src/layouts/MainLayout.tsx` | 设置页面标题；rail 新增搜索按钮；跳过 `/tools/:id` 的标题（交给 ToolsLayout） |
| `src/pages/tools/ToolsLayout.tsx` | 标题取工具名；标签栏改接 `useToolTabsStore`；返回链接改 `/home` |
| `src/components/SectionNav.tsx` | 新增 `backTo` / `backLabel`，渲染 `.vc-backlink` |
| `src/pages/Home/SearchBar.tsx` | 监听 `veythcog:focus-search` 事件聚焦输入框 |
| `src/styles/page.css` | `.vc-palette*` 与 `.vc-subnav__back` 样式，全部使用令牌 |

## 2. 标题规则

- 基准：`index.html` 的 `渡思｜VeythCog`；有页面标题时拼为 `${title}｜渡思｜VeythCog`。
- 映射（`resolvePageTitle`）：
  `/home` 导航首页；`/chat` 对话；`/knowledge` 知识库；`/tools` 工具集；
  `/settings` 设置；`/settings/account` 账号设置；`/settings/providers` 模型配置；
  `/settings/lark` 飞书绑定；`/settings/appearance` 外观；
  `/admin` 系统管理；`/admin/users` 用户管理；`/admin/roles` 角色管理；
  `/admin/models` 模型目录；`/admin/monitor` 系统监控；`/admin/audit` 审计日志；
  `/admin/tasks` 定时任务；`/admin/config` 系统配置；`/login` 登录。
- `/tools/:id` 返回 `null`（MainLayout 不设），由 `ToolsLayout` 用当前工具名设置；
  工具 id 失效时回落「工具集」。
- Login / Home 自行调用 `useDocumentTitle`。

## 3. 命令面板

### 3.1 数据来源

| 分组 | 来源 | 说明 |
|---|---|---|
| 页面 | 常量表（含 admin 项，仅管理员） | 静态，零网络 |
| 工具 | `@/pages/tools/registry` 的 `tools` | 仅读元数据，不触发 lazy 组件加载 |
| 书签 | `getAllBookmarks()`（已有 5 分钟缓存） | 首次打开面板时静默拉取，失败隐藏分组 |
| 操作 | 切换亮/暗、打开外观、退出登录 | 复用 `useTheme().setAppearance` / `authStore.logout` |

### 3.2 交互

- `Ctrl/Cmd + K`：toggle 面板；面板内按 Esc 关闭（AntD Modal `keyboard`）。
- 输入 ≥1 字符过滤（子串、忽略大小写）；空查询展示页面 + 工具 + 书签前若干条。
- ↑/↓ 移动、Enter 执行、Home/End 跳首尾；选中项滚动到可视区。
- 执行后关闭面板并清空查询；书签项 `window.open(url, '_blank', 'noopener,noreferrer')`。
- `/`：仅在 `/home` 且焦点不在可编辑元素时触发，派发 `window` 自定义事件
  `veythcog:focus-search`；SearchBar 收到后 `inputRef.focus()`。
- rail 搜索按钮派发 `veythcog:open-palette`，CommandPalette 监听后打开。
- `/login` 不渲染命令面板（`return null`，Hooks 之前判断）。

### 3.3 无障碍与样式

- Modal 自带 `role=dialog` 与焦点圈定；列表 `role="listbox"`、项 `role="option"`、
  `aria-selected`、`aria-activedescendant` 指向当前项 id；输入框 `aria-label="全局搜索"`。
- 样式只用令牌（`--color-*`、`--radius-*`、`--space-*`、`--duration-fast`），
  选中态用 `color-mix(in srgb, var(--color-primary) 12%, transparent)`，
  宽度 `min(600px, calc(100vw - 32px))`，列表最大高 `min(60vh, 420px)` 内部滚动。

## 4. 鉴权回跳

`RequireAuth`：`state={{ from: location.pathname + location.search + location.hash }}`。
Login 已用 `resolveLanding(from)`，仅需保证 `from` 不是 `/login`；字符串拼接不会引入新逻辑。

## 5. 工具集标签持久化

`useToolTabsStore` 已存在（`persist`，key `mywork:tool-tabs`），`ToolTab` 需 `openedAt`。

- 挂载 / URL 变化时对合法工具调用 `openTab({ id, name, openedAt: Date.now() })`；
- 渲染前用 registry 过滤，registry 中已删除的 id 自动忽略；
- 关闭当前标签：取删后相邻标签（先右后左）再 `closeTab` 并 `navigate`；无相邻回 `/tools`；
- 不再维护组件内 `useState` 标签列表。

## 6. 回退与边界

- 书签接口失败：面板不展示书签分组，不弹错；
- 主题切换后 Modal 由 AntD ConfigProvider 重新下发 token，不需要手动刷新；
- 服务端渲染不涉及（纯 Vite SPA）。
