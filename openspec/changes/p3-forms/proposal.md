# P3 · 表单体验增强

> 状态：apply 完成（2026-11-14 实现并验证，待 archive）
> 关联：`openspec/changes/p3-nav-experience`
> 关联：`VeythCog-V/docs/frontend-style-guide.md`

## 1. 为什么做

页面骨架已完成，但表单交互仍是三种并存的做法：

| 问题 | 影响 |
|---|---|
| `BookmarkModal` 手写 state 校验 + `message.warning` | 校验结果只以 toast 出现，字段旁没有错误提示，键盘与读屏用户容易漏看 |
| `Login` 手写 state 校验 + `message.warning` | 同上；注册与登录逻辑分散在命令式函数里 |
| `api/client.ts` 超时/断网抛原始 `DOMException`/`TypeError` | 英文 `signal is aborted without reason` 会直接冒到界面 |
| 各页校验手段不一（rules / toast / 无） | 维护与视觉一致性差 |

## 2. 做什么（In scope）

1. `BookmarkModal` 的网址/名称迁移到 AntD `Form` + `rules`，错误内联展示；图标文字/图片缺失改为内联错误，不再用 toast。
2. `Login` 的登录/注册表单改为 `Form` + `name` + `rules`（required、密码长度、两次密码一致），错误内联展示。
3. `api/client.ts` 把超时（`AbortError`）与网络失败（`TypeError`）转成中文 `ApiError`，界面不再出现英文异常。
4. `page.css` 新增 `.vc-field-error` 错误文案样式（仅令牌）。

## 3. 不做什么（Out of scope）

1. 不改 `Admin/Users`、`Admin/Models`、`Settings/Account`（已使用 rules，确认无回归即可）。
2. 不改 `Settings/Providers` 的草稿 patch 态、知识库保存工具栏（非校验问题）。
3. 不引入统一错误摘要组件、不做错误码映射表。
4. 不改表单视觉骨架（`vc-form-card` / `vc-field-label` 保留）。

## 4. 影响面

- `VeythCog-V/src/api/client.ts`
- `VeythCog-V/src/pages/Home/BookmarkModal.tsx`
- `VeythCog-V/src/pages/Login/index.tsx`
- `VeythCog-V/src/styles/page.css`
