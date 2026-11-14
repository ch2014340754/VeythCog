# P3 · 对话输入框布局优化

> 状态：apply 完成（2026-11-14 实现并验证，待 archive）
> 关联：`openspec/changes/p3-forms`、`openspec/changes/p3-nav-experience`
> 关联：`VeythCog-V/docs/frontend-style-guide.md`

## 1. 为什么做

用户反馈（截图 + 文字）：

| 问题 | 现状 |
|---|---|
| 左端过于紧凑 | 知识库引用标签与提示、压缩开关、附件/联网/语音图标、模型下拉全部挤在左下角同一行 |
| 拖拽把手消失 | DOM 里存在 `composer-resize-handle` / `composer-resize-grip`，但 `page.css` 中没有任何对应样式，把手不可见、不可发现 |
| 图标与按钮无分组 | 工具按钮与参数控件平铺，视觉上无法区分「能做什么」和「用什么参数」 |

## 2. 做什么（In scope）

1. 工具行拆成两组：左侧「工具」组（知识库、附件、联网搜索、语音输入），右侧「参数」组（压缩开关、模型下拉、已绑定模型），两组之间 1px 分隔线，右侧组 `margin-left: auto` 靠右。
2. 补齐拖拽把手样式：静置一条 44×4 的圆角横线，hover / 键盘聚焦 / 拖拽中变 60×4 主色；`cursor: ns-resize`、`touch-action: none`、`:focus-visible` 焦点环；保留原 `role="slider"`、`aria-valuemin/max/now` 与方向键逻辑。
3. 知识库引用行增加内边距与 10px 间距，提示文案单行省略，避免与标签挤在一起。
4. 模型下拉与「已绑定模型」收敛为 2px 间距，右组内部 8px 间距。

## 3. 不做什么（Out of scope）

1. 不改输入框高度上下限（`MIN_COMPOSER_HEIGHT` / `MAX_COMPOSER_HEIGHT`）、拖拽算法与方向键步长。
2. 不改发送按钮形态（内嵌输入框右下圆形按钮）。
3. 不做 ≤520px 移动端换行 / 触屏拖拽适配（属后续批次）。
4. 不改知识库抽屉、模型选择交互与 SSE 流式逻辑。

## 4. 影响面

- `VeythCog-V/src/pages/Chat/index.tsx`
- `VeythCog-V/src/styles/page.css`

## 5. 验收

- `cd VeythCog-V && npx tsc --noEmit` 与 `npm run build` 均 EXIT=0。
- 4173 preview 实测（`getBoundingClientRect` / `getComputedStyle`）：把手 44×4、`border-radius: 9999px`、`cursor: ns-resize`、`touch-action: none`；从把手向上拖拽 140px 后 `textarea` 高度 44 → 110，`grip` 含 `is-active`；合成 `ArrowUp` 使 44 → 68。
- 分组矩形：左组 x≈418–542，分隔线 x≈550，右组 x≈2408–2488（容器 405–2501），确认左右分组与右侧靠齐。
