# 设计 · 对话输入框布局优化

## 1. 把手为什么之前不见了

`Chat/index.tsx` 早在拖拽功能实现时就渲染了：

```tsx
<div className="composer-resize-handle" role="slider" ...>
  <div className={'composer-resize-grip' + (isActive ? ' is-active' : '')} />
</div>
```

但 `page.css` 里只定义了 `.vc-floating-dialog__resize`，没有这两个类。元素是普通 `div`，无尺寸、无背景，因此既看不见也无法命中（宽高为 0）。拖拽算法本身是好的，所以问题是纯样式缺失。

## 2. 把手样式

- 容器 `.vc-composer__resize`：`display:flex`、`height:12px`、`width:100%`、`cursor:ns-resize`、`touch-action:none`、`margin:2px 0 -2px`，把命中区做满一行但只占 12px 高。
- 可视抓手 `.vc-composer__grip`：44×4、`border-radius: var(--radius-full)`、`background: var(--color-border)`，静置即可见（用户此前反馈"不见了"，因此不做 hover 才显形）。
- hover / `is-active`（高度大于最小值）/ `:focus-visible`：60×4、主色；聚焦态加 `box-shadow` 环。
- 只过渡 `width` 与 `background`，符合"只动 transform/opacity 之外的低成本属性"约束；均为 1px 级重绘，无布局抖动（把手本身绝对高度不变）。

## 3. 工具行分组

原结构是扁平的 9 个控件，语义混杂。新结构：

```tsx
<div className="vc-composer__tools">
  <div className="vc-composer__group">知识库 / 附件 / 联网 / 语音</div>
  <span className="vc-composer__divider" aria-hidden="true" />
  <div className="vc-composer__group vc-composer__group--end">压缩 / 模型 / 已绑定</div>
</div>
```

- `.vc-composer__tools`：`flex-wrap` + `gap:8px` + `row-gap:4px`，窄屏仍可换行。
- `.vc-composer__group`：`inline-flex` + `gap:4px`；`--end` 用 `margin-left:auto` 推到右侧。
- 分隔线 1×16，用 `--color-divider`，`aria-hidden`。
- 顺带把知识库引用行 `padding` 从 `8px 8px 2px` 调为 `10px 10px 0`、间距 8→10px，提示文字 `text-overflow:ellipsis`，在长标题时不撑破一行。

## 4. 命名

原有类名 `composer-resize-handle` / `composer-resize-grip` 未遵循仓库的 `vc-*` BEM 约定，本次改为 `.vc-composer__resize` / `.vc-composer__grip`（同步 JSX 与 CSS），避免与新样式体系混淆。

## 5. 备选方案

| 方案 | 结论 |
|---|---|
| 把手默认 `opacity:0`，hover 才显形 | 否决：这正是用户"找不到"的体验，静置需可见 |
| 把压缩开关移到输入框右上角 | 否决：破坏"工具行 = 本会话设置"的单一层级，且右侧组空间足够 |
| 用 `gap` + 伪元素画分隔线 | 否决：伪元素在换行时定位不可控，显式 `<span>` 更稳 |
