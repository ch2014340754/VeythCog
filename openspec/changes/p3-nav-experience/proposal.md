# P3 · 导航体验增强

> 状态：apply 完成（2026-11-14 实现并验证，待 archive）
> 关联：`openspec/nav-search-prd.md`（首页搜索框已具备联想/翻译/AI，本期不重复）
> 关联：`VeythCog-V/docs/frontend-style-guide.md`

## 1. 为什么做

现有导航骨架可用，但「人找页面」的路径不完整：

| 问题 | 影响 |
|---|---|
| 全站无 `document.title` 更新 | 多标签、收藏、历史记录都显示同一个标题 |
| 无全局命令面板（Ctrl+K） | 工具/设置/书签只能逐层点进去 |
| `RequireAuth` 只记 `pathname` | 未登录时打开带 query 的深链，登录后丢参数 |
| 工具集「返回工作区」写死 `/chat` | 与工具集落地页 `/home` 不一致 |
| 工具集 openTabs 用 `useState` | 刷新后多标签工作区丢失（`toolTabsStore` 已写好但未接线） |
| 设置/系统管理二级侧栏无出口 | 进入后台后只能靠 rail 或 logo 回到首页 |

## 2. 做什么（In scope）

1. 全局命令面板 `Ctrl/Cmd + K`：页面、工具、书签统一检索并跳转；rail 增加搜索入口。
2. 首页 `/` 快捷键聚焦搜索框（输入框内不抢键）。
3. 按路由更新 `document.title`（含工具名）。
4. `RequireAuth` 保留 `pathname + search + hash`，登录后原样回跳。
5. 工具集返回链接改为 `/home`，标签栏接入 `useToolTabsStore` 持久化。
6. `SectionNav` 增加「返回首页」入口，设置 / 系统管理共用。
7. `RequireAdmin` 非管理员回落 `/home`（与全站落地页一致）。

## 3. 不做什么（Out of scope）

- ❌ 不做会话搜索（`chatStore` 仍是 mock，等 SSE/会话列表真实化后再接）。
- ❌ 不做 Admin Users/Roles/Audit/Tasks 的 loading/error 状态补齐（下一批「状态一致性」）。
- ❌ 不做移动端 ≤520px 布局、表格横向滚动（下一批「响应式」）。
- ❌ 不引入新依赖、不改后端接口。
- ❌ 不做命令面板的模糊拼音匹配（只做子串匹配，拼音留待后续）。

## 4. 影响面

前端仅 `VeythCog-V`：
`src/App.tsx`、`src/layouts/MainLayout.tsx`、`src/pages/tools/ToolsLayout.tsx`、
`src/components/SectionNav.tsx`、`src/pages/Settings/index.tsx`、`src/pages/Admin/index.tsx`、
`src/pages/Home/SearchBar.tsx`、`src/pages/Home/index.tsx`、`src/pages/Login/index.tsx`、
新增 `src/components/CommandPalette.tsx`、`src/hooks/useDocumentTitle.ts`、`src/utils/pageTitle.ts`、
`src/styles/page.css`。

无接口变更、无数据结构变更、无数据库迁移。

## 5. 验收口径

- `npx tsc --noEmit` exit 0，`npm run build` exit 0；
- Ctrl+K 在 `/chat`、`/knowledge`、`/tools/*`、`/settings/*`、`/admin/*`、`/home` 均可打开；Esc 关闭；↑/↓/Enter 可用；
- 手输 `/tools/json-formatter` 刷新后 title 为「JSON 格式化」；`/settings/providers` 为「模型配置」；
- 未登录访问 `/knowledge?doc=12#top`，登录后回到同一路径（含 query/hash）；
- 工具集刷新后标签页仍在；关闭当前标签跳到相邻标签，全关回 `/tools`；
- 暗色 / 亮色、玻璃开 / 关、壁纸开 / 关下命令面板文字对比度正常；
- ≤520px 宽下命令面板宽度 `calc(100vw - 32px)`，不横向溢出。
