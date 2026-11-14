# 表单体验增强 · 任务清单

- [x] T1 `api/client.ts`：`AbortError` → 中文超时、`TypeError` → 中文网络错误
- [x] T2 `BookmarkModal.tsx`：网址/名称迁移 `Form` + rules，图标校验改内联 `iconError`
- [x] T3 `Login/index.tsx`：登录/注册迁移 `Form` + name + rules，去掉 warning toast
- [x] T4 `page.css`：`.vc-field-error` 样式（令牌色）
- [x] T5 验证：`npx tsc --noEmit`、`npm run build`、运行时内联错误抽查
- [x] T6 文档：`.ai-context/change-log.md`、`current-tasks.md` 同步
