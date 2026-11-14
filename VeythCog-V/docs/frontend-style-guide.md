# 渡思 VeythCog · 前端视觉规范（v1.0）

> **权威性**：本文件是 `VeythCog-V` 所有页面的视觉契约。与代码冲突时**以本文件 + `src/contexts/ThemeContext.tsx` / `src/styles/global.css` 为准**，并回写修正。
> **适用对象**：所有接手前端的 Agent / 协作者。新增页面、改版、修样式前先读第 11 节 checklist。
> **参考实现**：登录页 `src/pages/Login/`（`index.tsx` + `login.css`）是当前视觉基准，任何"不确定长什么样"的问题都以它为准。
> **信息基准**：2026-11-14，依据实际源码（`global.css` 753→1100 行、`ThemeContext.tsx`、`presets.ts`、`MainLayout.tsx`、`Login/*`）。

---

## 1. 设计语言一句话

> **淡紫低饱和的空间感 + 真毛玻璃层叠 + 克制的品牌紫光；所有颜色来自主题预设，所有动效只改 transform / opacity。**

三条不可让渡的原则：

1. **不堆纯白卡片**。卡片是"玻璃片"，靠 `backdrop-filter` 与周围背景产生关系，而不是靠白底 + 黑影。
2. **不硬编码颜色**。颜色只有三个来源：主题预设（`presets.ts`）、`useTheme().colors`、CSS 变量 `--color-*` / `--glass-*`。
3. **不炫技**。同屏永久动画 ≤ 2 组；位移、缩放有上限；`prefers-reduced-motion` 必须全部关闭。

---

## 2. 颜色体系（三层，必须按层取色）

### 2.1 第一层：主题预设（唯一真源）

`src/styles/presets.ts`，6 套 preset × 亮/暗两套。默认 `amethyst`（紫晶）。localStorage 键：`theme-preset`、`theme-appearance`（`light | dark | system`）。

| preset | label | 亮色 primary | 亮色 bg | 暗色 primary | 暗色 surface |
|---|---|---|---|---|---|
| amethyst | 紫晶 | `#7C3AED` | `#FAF5FF` | `#A78BFA` | `#2A2756` |
| amber | 琥珀 | `#D97706` | `#FFFBEB` | `#FBBF24` | `#292524` |
| emerald | 翡翠 | `#059669` | `#ECFDF5` | `#34D399` | `#064E3B` |
| indigo | 靛蓝 | `#4F46E5` | `#EEF2FF` | `#818CF8` | `#2A2756` |
| rose | 玫瑰 | `#E11D48` | `#FFF1F2` | `#FB7185` | `#881337` |
| slate | 石墨 | `#475569` | `#F8FAFC` | `#94A3B8` | `#1E293B` |

**禁止**：在组件里写死 `#7C3AED`、`rgba(124,58,237,...)`。需要主色透明度时用 `colors.primary10/15/30/40` 或 `--color-primary-10/15/30/40`。

### 2.2 第二层：`useTheme().colors`（TSX 内的首选）

`ThemeContext` 已把预设 + 明暗 + 毛玻璃开关算成完整颜色集，供 **inline style** 直接用（避免 CSS 变量解析延迟）：

```ts
const { colors, isDark } = useTheme();
<div style={{ background: colors.surface, color: colors.text, border: `1px solid ${colors.divider}` }} />
```

字段：`primary / primary10 / primary15 / primary30 / primary40 / secondary / cta / accent / bg / text / textSecondary / textTertiary / textTertiary15 / textInverse / border / divider / surface / surfaceElevated / surfaceOverlay / success / warning / error / info / glassBg / glassBorder`。

**明暗派生值（不要自己算）**：

| 字段 | 亮色 | 暗色 |
|---|---|---|
| `surface` | 毛玻璃开 → `rgba(255,255,255,0.55)`；关 → `#ffffff` | 毛玻璃开 → preset.surface @0.55；关 → 实色 |
| `surfaceElevated` | 毛玻璃开 → `rgba(255,255,255,0.65)` | preset.surfaceElevated @0.65 |
| `glassBg` | `rgba(255,255,255, 0.1 + glassOpacity/100*0.65)` | `preset.surface @(同公式)` |
| `textSecondary` | `#6B7280` | `#9CA3AF` |
| `textTertiary` | `#9CA3AF` | `#8A8FA3`（暗色必须提亮） |
| `divider` | `#E5E7EB` | `preset.border @0.4` |
| `textInverse` | `#ffffff` | `#1E1B4B` |

### 2.3 第三层：CSS 变量（`global.css` / 自己的 scoped css 用）

`ThemeContext.applyCSSVariables()` 在 `useLayoutEffect` 里写入 `document.documentElement`：
`--color-primary / -secondary / -cta / -accent / -bg / -text / -border`、`--color-primary-10/15/30/40`、`--color-surface(-elevated/-overlay)`、`--color-text-secondary/-tertiary/-tertiary-15/-inverse`、`--color-divider`、`--color-success/warning/error/info`、`--noise-opacity`（亮 0.03 / 暗 0.04）、`--glass-bg`、`--glass-border`、`--shadow-sm..xl`。
同时 `body` 上挂 `dark` / `glass-on` / `has-bg` 三个 class，并写 `--bg-overlay`。

**页面级 scoped 变量写法（推荐）**：像登录页那样，在组件根节点注入一组 `--lg-*`，颜色全部由 `colors` 派生，CSS 只消费变量：

```ts
const cssVars = {
  '--lg-primary': colors.primary,
  '--lg-card-bg': isDark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.56)',
  '--lg-field-bg': isDark ? '#2E2952' : 'rgba(255,255,255,0.72)',
} as React.CSSProperties;
<section className="vc-login" style={cssVars}>
```

好处：亮/暗差异集中在一个对象里，CSS 里不出现 `body.dark` 满天飞；**若必须写暗色差异，用 `body.dark .xxx` 只覆盖 2–3 个变量，不要重写整块规则**。

---

## 3. 令牌表（`global.css :root`，逐字使用）

**圆角**：`--radius-sm 6` / `--radius-md 10` / `--radius-lg 16` / `--radius-xl 24` / `--radius-full 9999`
**间距**：`--space-xs 4` / `sm 8` / `md 16` / `lg 24` / `xl 32` / `2xl 48`
**阴影**：`--shadow-sm/md/lg/xl`（亮色黑 5–10%；暗色由 `body.dark` 覆盖为 30–50%）
**字体**：`--font-heading: 'Space Grotesk'`、`--font-body: 'DM Sans'`（`index.html` 预加载 4+4 字重）
**曲线**：`--ease-out: cubic-bezier(.16,1,.3,1)`（进场/位移默认）、`--spring: cubic-bezier(.34,1.56,.64,1)`（仅用于小元件回弹）、`--ease-in-out: cubic-bezier(.83,0,.17,1)`
**时长**：`--duration-fast 150ms`（hover）/ `normal 250ms`（默认过渡）/ `slow 400ms`（面板进出）
**z-index**：`--z-dropdown 1000 / sticky 1020 / fixed 1030 / modal-backdrop 1040 / modal 1050 / popover 1060 / tooltip 1070` —— **禁止魔法数字**。
**毛玻璃**：`--glass-blur 16px`、`--glass-bg rgba(255,255,255,.6)`、`--glass-border rgba(255,255,255,.3)`

**响应式放大（只放大圆角/间距，不缩放字号）**：

```
≥640px  --radius-sm 8  --radius-md 12
≥768px  --space-md 20  --space-lg 28
≥1024px --space-lg 32  --space-xl 40
≥1280px --space-xl 48  --space-2xl 64
```

**大屏（≥1900px，4K 全屏常见）**：页面容器再放大一档（登录页实测：`max-width 1680`、列间距 152、headline 56、卡片 466）。4K 下不放大 = 页面看起来"缩在中间一小块"。

---

## 4. 排版

| 层级 | 规格 | 用途 |
|---|---|---|
| Display | 48–56px / 700 / `--font-heading` / line-height 1.12 / letter-spacing -0.02em | 登录页品牌语、空态大标题 |
| H1 | 28px / 700 | 页面主标题 |
| H2 | 22px / 700 | 区块标题、登录卡片标题 |
| H3 | 16–17px / 600 | 卡片内小节 |
| Body | 14px / 400 / line-height 1.6 | 正文、列表项 |
| Body-strong | 14px / 600 | 表单项值、列表主字段 |
| Caption | 13px / 400 / `colors.textSecondary` | 说明、副标题 |
| Micro | 11–12px / 500 / `colors.textTertiary` / letter-spacing .06–.2em | 标签、eyebrow、元信息 |

规则：
- 中文标题不要用 `letter-spacing` 正值拉散（"欢迎回来"这类短标题除外可加 .1em 做仪式感）；英文/编号 label 用大写 + 0.2em 间距。
- 数字（时间、计数）用 `fontVariantNumeric: 'tabular-nums'` 防跳动。
- 正文最大宽度 60–72 字符；说明性文字 `line-height 1.75` 更耐读。
- **暗色下辅助文字必须提到 `#9CA3AF` / `#8A8FA3`**，不要沿用亮色的 `#6B7280`（对比不足）。

---

## 5. 玻璃拟态：四层用法

| 层 | 谁用 | 配方 |
|---|---|---|
| 页面背景 | `body` + `WallpaperBackdrop` | 主题 `--color-bg` 或壁纸图 + `--bg-overlay` 遮罩 + `body::before` 噪点（0.03/0.04） |
| 大容器（导航 rail / 内容卡） | `MainLayout` | `className="glass-effect"`（`--glass-bg` + `blur(--glass-blur)` + 1px `--glass-border`）+ 内联 `backdropFilter: blur(2 + glassOpacity/100*28 px) saturate(160%)` |
| 浮层（Card / Modal / Dropdown / Popover / Select 面板） | AntD，`body.glass-on` 自动接管 | `blur(20px) saturate(180%)` + `border 1px rgba(255,255,255,.45)`（暗 `.08`）+ `box-shadow 0 8px 32px rgba(31,38,135,.15)` + `inset 0 1px 0 rgba(255,255,255,.6)`（暗 `.08`） |
| 输入件（Input / Select / Picker / 默认按钮） | AntD，`body.glass-on` | `blur(12px) saturate(160%)` + `inset 0 1px 0 rgba(255,255,255,.4)` |
| 业务面板（表格/管理页） | `.admin-panel` | `--color-surface` + `1px --color-border` + `--radius-lg`；`glass-on` 时换 `--glass-bg` + blur |

**配方禁区**：
- `blur()` 超过 40px 在 4K 屏上会明显掉帧，且边缘出现"奶白糊"。
- 玻璃片**必须**有 1px 半透明描边，否则和背景粘在一起（登录页第一版就是这个毛病）。
- `saturate()` 用来"提亮背景色"，暗色下要降到 135–140%，否则背景光斑会把整个卡片染成饱和蓝紫。

---

## 6. 布局骨架

```
App (ThemeProvider → ConfigProvider → WallpaperBackdrop → BrowserRouter → GlobalMusic → ErrorBoundary → Suspense → Routes)
 └─ MainLayout：左侧 72px 悬浮毛玻璃 rail（fixed top/left/bottom 10, radius --radius-xl）
    → 内容区 marginLeft 92（=72+10+10），内层 1 张 radius --radius-xl 的玻璃卡，`<Outlet/>` 在其内
        └─ 页面：内部可再分二级侧栏（Settings 200 / Tools 260 / Chat 280）
```

规则：
- **rail 只有 72px**：图标 20–22px，激活态是"图标 + 一个 2px 高亮条 + 背景 tint"，不要加文字标签。
- 有壁纸时图标色改 `rgba(255,255,255,0.88)`（`MainLayout` 已实现），新增的 rail 元素要跟着走这条规则。
- 页面内容**必须**在玻璃卡内部滚动（`overflow: hidden` 在外层，`overflow-y: auto` 在内层），不要让整页滚动。
- 二级侧栏宽固定 + `borderRight: 1px solid colors.divider`；项高 36–40，`radius --radius-md`。
- 页面内边距：常规 24–32；紧凑列表 16–20；4K 放大档 40–48。
- 空态、加载态、错误态都要在内容卡内部居中，不要撑破布局。

---

## 7. 组件级规范

**按钮**
- 主按钮：`background: colors.primary`（可叠一层同色相渐变：亮色叠加 `rgba(0,0,0,.24)` 压深、暗色叠加 `rgba(255,255,255,.26)` 提亮）；文字 `#fff`（暗色下主色被提亮到 `#A78BFA` 一类，改用 `#14102B` 深字保证对比 ≥ 4.5:1）。
- 次按钮：透明底 + `1px colors.border`；hover 背景 `colors.primary10`。
- 危险：`colors.error`，只用于删除/不可逆操作。
- 高度：常规 36 / large 44 / 登录主按钮 48–52；圆角 `--radius-md`（大按钮 `--radius-full` 或 14）。

**输入**
- 底 `--lg-field-bg`（亮 `rgba(255,255,255,.72)`、暗 `#2E2952` 这类**不透明**色，避免和卡片玻璃互相透），边框 `rgba(primary, .18)`，focused 边框 `primary` + `box-shadow 0 0 0 3px rgba(primary,.14)`。
- 高度 44（紧凑 40）；label 13px / 600 / `colors.text`，与输入框间距 6–8。
- **必须覆盖浏览器自动填充**（否则暗色下输入框会变 Chrome 的浅蓝 `#E8F0FE`）：

```css
.vc-login input:-webkit-autofill,
.vc-login input:-webkit-autofill:hover,
.vc-login input:-webkit-autofill:focus {
  -webkit-text-fill-color: var(--lg-text);
  box-shadow: 0 0 0 1000px var(--lg-field-autofill) inset;
  transition: background-color 9999s ease-in-out 0s;
}
```

**Segmented / Tab（胶囊）**
- 容器 `padding 4` + `radius 999` + `colors.surface`；滑块 `position absolute; left 4; width calc(50% - 4px); background colors.primary; transform translateX(100%)`；`transition transform .28s cubic-bezier(.4,0,.2,1)`；激活项文字在亮色 `#fff`、暗色 `#14102B`。
- 面板切换用 `.vc-tab-pane`（`global.css` 已有入场动画），不要自造。

**表格（管理端）**
- 外层 `.admin-panel`，表格 `.admin-table`（半透明表面 + `--radius-lg`）；表头 13px/600、行高 48、hover 行 `colors.primary10`。

**图标**
- 一律 `@iconify/react` + `@iconify-icons/lucide`（已安装）；尺寸 16（行内）/ 20（rail、工具卡）/ 22（大按钮）。不要引第二套图标库。

---

## 8. 动效

**允许的类型**：位移（≤ 20% 容器尺寸）、缩放（0.94–1.28）、透明度（0.3–1）、`backdrop-filter` 的轻微呼吸、颜色渐变。
**禁止**：改 `width/height/top/left` 做动画、`filter: blur()` 大范围动画、无限旋转的装饰元素、同屏 >2 组常驻动画。

**时长表**：hover 150ms / 状态切换 250ms / 面板进出 400ms / 环境光漂移 4–12s（多段 keyframes，首尾同值才能无缝循环）。

**曲线**：位移与进场用 `--ease-out`；小元件回弹用 `--spring`；环境光用 `ease-in-out`。

**必须写的降级**（登录页已实现，新页面照抄思路）：

```css
@media (prefers-reduced-motion: reduce) {
  .anim-x { animation: none !important; transform: none !important; }
}
@media (hover: none), (pointer: coarse) {
  .parallax-layer { transform: none !important; }
}
```

**性能**：只对 `transform` / `opacity` 做动画；`will-change` 只在动画期间加；大量 blur 元素叠在一起时优先减层数而不是加 `will-change`。

---

## 9. 参考实现：登录页（`src/pages/Login/`）

图层自下而上：

```
.vc-login（底色：primary-15 左上 + primary-10 右下 + --color-bg）
 └ .vc-login__scene（fixed）
    ├ .vc-login__core      静态底光（离开卡片的两团 radial，保证光斑飘走时页面仍成立）
    ├ .vc-login__orbit     ±7° 缓慢摇摆的容器（12s）
    │  └ .vc-login__aurora 指针视差层（--lg-mx/--lg-my，34px/26px）
    │     └ .vc-login__blob--a/b/c/d  4 团彩色光斑（5s/5s/7s/4s，位移 12–20% + scale ≤1.28）
    ├ .vc-login__grid      64px 网格（mask 向中心淡出）
    ├ .vc-login__noise     噪点
    └ .vc-login__vignette  暗角呼吸（10s）
 └ .vc-login__inner（两栏：品牌 aside + 表单 main）
    └ .vc-login__card（玻璃：blur(32px) saturate(180%)
       ├ .vc-login__ring / .vc-login__ring--halo  conic 渐变描边（跟随指针方位）
       └ 表单区（seg 胶囊 / 字段 / 主按钮 / 运行模式折叠）
```

关键做法（复用价值最高）：

1. **光斑必须"留家"**：`__core` 是不动的底光。只做漂移光斑时，某个相位会把画面甩成纯白、卡片失去色彩支撑（真实踩坑）。
2. **描边用 conic + mask**，而不是 border-image：

```css
.vc-login__ring {
  position: absolute; inset: 0; border-radius: inherit; padding: 1.5px;
  background: conic-gradient(from calc(var(--lg-angle, 205deg) - 58deg),
    transparent 0deg, var(--lg-glow-1) 24deg, var(--lg-glow-2) 58deg,
    var(--lg-glow-1) 92deg, transparent 116deg);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor; mask-composite: exclude;
}
```

3. **方位角**：`phi = atan2(dx, -dy)`（conic 0deg 在正上方、顺时针）；`dx/dy` 必须除以**同一个** `unit = box.height/2`，横竖分别归一化会把角度压歪。指针 lerp 0.18，变化过大时直接吸附，否则高亮弧会绕圈扫。
4. **亮暗两套高光**：亮色卡边接近纯白，白色高光会被吃掉 → 亮色高光用 `rgba(primary,.42/.98)`；暗色卡身饱和 → 保留白色芯 `rgba(255,255,255,.95)`。
5. **`--lg-glow` 距离衰减**：`clamp(0.32, 1.18 - dist*0.42, 1)`，指针离开时描边变淡而不是消失。
6. **指针监听用一个 rAF**：`cardRef` 与 `auroraRef` 共用一条帧循环，卸载时 `removeEventListener` + `cancelAnimationFrame`。
7. **暗色主色对比**：暗色 preset 的 primary 被提亮（`#A78BFA`），白字只有 ~2.4:1 → 改为"亮色填充 + `#14102B` 深字"，约 8:1。

---

## 10. 暗色适配清单

- [ ] 所有 `colors.*` 取值都走 ThemeContext（已自动明暗切换）。
- [ ] 硬编码的白/黑（`rgba(255,255,255,.5)` 等）逐个检查：暗色下是否该换成 `rgba(0,0,0,.3)` 或 `preset.surface @alpha`。
- [ ] 辅助文字提亮：`#9CA3AF` / `#8A8FA3`。
- [ ] 输入框、下拉面板、表格用不透明或高不透明度底色（暗色下玻璃叠加容易"糊成一片"）。
- [ ] `backdrop-filter` 的 `saturate` 降到 135–140%，`blur` 略增（34px 级别）。
- [ ] 阴影换深色（`--shadow-*` 已由 `body.dark` 覆盖，自写阴影时用 `rgba(0,0,0,.35–.5)`）。
- [ ] 自动填充、滚动条、`::selection`、`focus-visible` 在暗色下都可见。

---

## 11. 新页面 checklist（提交前逐条过）

1. 颜色是否**全部**来自 `colors` 或 `--color-*`？grep 一遍 `#` 和 `rgb(`。
2. 页面是否在 `MainLayout` 的玻璃卡内、`marginLeft: 92` 之外不自己加 fixed 元素？
3. 圆角/间距/阴影是否用了令牌（`--radius-*` / `--space-*` / `--shadow-*`）而不是 13px、17px 这类随手值？
4. 标题层级是否 ≤ 3 级、字号是否落在第 4 节的表里？
5. 空态 / 加载态 / 错误态是否都设计过（且都在内容卡内部）？
6. 暗色模式下过一遍第 10 节清单（真机切 `theme-appearance=dark`）。
7. 窄屏（≤520px）与矮屏（≤780px 高）是否可操作（登录页的 `max-height: 780px` 压缩档是范例）？
8. 4K（2544×1380）下内容是否过大或过小、是否需要 ≥1900px 放大档？
9. 动效是否只动 `transform/opacity`？是否加了 `prefers-reduced-motion` 与 `(pointer: coarse)` 降级？
10. `npx tsc --noEmit` 是否 0 错误？控制台是否有 React key / 受控组件 warning？

---

## 12. 反模式（都是本项目真实踩过的）

| 反模式 | 后果 | 正确做法 |
|---|---|---|
| `primary → accent` 渐变 | amethyst 的 accent 是 `#FBBF24`（琥珀），紫→黄被读成"夕阳橙" | 同色相叠加：主色 + 白 0.26（提亮）/ 黑 0.24（压深） |
| 玻璃卡片没有描边 | 卡片与背景粘在一起，看不出是"片" | 1px `rgba(255,255,255,.3–.45)`，暗色 `.08` |
| 只放漂移光斑、没有静态底光 | 某个相位整页发白，卡片失去色彩支撑 | 静态 `core` + 漂移层，位移 ≤ 20% |
| 暗色下白字 + 提亮主色 | 对比 ~2.4:1，读不清 | 亮填充 + 深字 `#14102B` |
| 用 `locator().boundingBox()` 做视觉验证 | 在 Tabbit/Playwright 里会挂死 | 用 `page.evaluate` 读 `getBoundingClientRect` / computed style |
| 截图给用户看当验收 | 用户明确要求"不要再输出图片" | 用数值验收：角度、px/s、opacity、对比度 |
| 变量下标硬编码 z-index | 弹层被遮挡、改一处崩一片 | 用 `--z-*` 令牌 |
| 整页滚动 + 内部再滚动 | 双层滚动条、移动端卡顿 | 外层 `overflow:hidden`，内层单点滚动 |

---

## 13. 验收与工具

- **类型检查**：`cd VeythCog-V && npx tsc --noEmit`（必须 exit 0）。
- **视觉验证**：dev server `npm run dev`（:3000）；用 Tabbit CLI 读 computed style / 几何量，**不要靠截图目测**（用户明确要求）。
  仓库根 `.tabbit/` 是这类验证脚本的**本机草稿区**（已 gitignore，可随时删除）；写法要点：`page.evaluate` 读 `getBoundingClientRect` / `getComputedStyle`、`waitUntil: 'domcontentloaded'` + 固定等待（后端未起时 `networkidle` 会挂到超时）、Tabbit CLI 的第一行 stdout 是 `TABBIT_PLAYWRIGHT_INSTANCE=…`，解析 JSON 取 `t.slice(t.indexOf('{'))`。
- **设计预览（可选，本机）**：截图放 `VeythCog-V/design-preview/`（已 gitignore，单张 3–4MB 不入库）；文件名约定 `login-desktop-2544.png`、`login-desktop-dark.png`、`login-laptop-1440.png`、`login-mobile-390.png`、`login-mobile-dark-390.png`、`login-register-2544.png`、`login-short-640.png`。目录可随时删除重建。
- **主题切换手测**：`localStorage['theme-preset']` / `['theme-appearance']`，或走 `/settings/appearance`。

---

## 14. 改动本文件

- 新增/修改视觉规则时：先改代码 → 再改本文件 → 在 `PROJECT_MEMORY.md` 的文档索引里保持条目有效。
- 规则冲突：以"用户明确要求" > 本文件 > 局部样式。局部破例时在代码注释里写清原因与日期。
