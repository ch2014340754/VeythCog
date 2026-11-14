# 导航体验增强 · 任务清单

- [x] T1 `hooks/useDocumentTitle.ts` + `utils/pageTitle.ts`：标题映射与 hook
- [x] T2 `MainLayout`：按路由设标题（`/tools/:id` 跳过）、rail 搜索按钮
- [x] T3 `ToolsLayout`：标题取工具名、返回 `/home`、标签接 `useToolTabsStore`
- [x] T4 `SectionNav` + `Settings/index.tsx` + `Admin/index.tsx`：返回首页入口
- [x] T5 `App.tsx`：`RequireAuth` 保留 query/hash；挂载 CommandPalette；`RequireAdmin` 回落 `/home`
- [x] T6 `CommandPalette.tsx`：数据分组、过滤、键位、a11y、自定义事件
- [x] T7 `Home/SearchBar.tsx` 监听 `veythcog:focus-search`；`Home/index.tsx`、`Login/index.tsx` 标题
- [x] T8 `page.css`：`.vc-palette*`、`.vc-subnav__back`、`.vc-kbd` 样式（仅令牌）
- [x] T9 验证：`npx tsc --noEmit`、`npm run build`、四主题态样式抽查
- [x] T10 文档：`.ai-context/change-log.md`、`current-tasks.md` 同步
