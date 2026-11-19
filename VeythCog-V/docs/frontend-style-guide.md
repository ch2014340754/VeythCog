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

`src/styles/presets.ts`，11 套 preset × 亮/暗两套。默认 `amethyst`（紫晶）。localStorage 键：`theme-preset`、`theme-appearance`（`light | dark | system`）。

| preset | label | 亮色 primary | 亮色 bg | 暗色 primary | 暗色 surface |
|---|---|---|---|---|---|
| amethyst | 紫晶 | `#7C3AED` | `#FAF5FF` | `#A78BFA` | `#2A2756` |
| emerald | 翡翠 | `#059669` | `#ECFDF5` | `#34D399` | `#064E3B` |
| indigo | 靛蓝 | `#4F46E5` | `#EEF2FF` | `#818CF8` | `#2A2756` |
| rose | 玫瑰 | `#E11D48` | `#FFF1F2` | `#FB7185` | `#881337` |
| slate | 石墨 | `#475569` | `#F8FAFC` | `#94A3B8` | `#1E293B` |
| tide | 潮汐 | `#0F7370` | `#D2EEEE` | `#1DC8C1` | `#173534` |
| sprout | 新芽 | `#0B772F` | `#D0F0DB` | `#16CF53` | `#163621` |
| cobalt | 钴蓝 | `#273BF6` | `#CED1F3` | `#6D8DFF` | `#161A40` |
| mono | 曜石 | `#2563EB` | `#F6F7F9` | `#5B8CFF` | `#0F1216` |
| sunset | 落日 | `#B45309` | `#FCF8F3` | `#F2A018` | `#382B14` |
| mist | 薄雾 | `#0369A1` | `#F5F8FA` | `#64BBD9` | `#1A2C32` |

> 潮汐/新芽/钴蓝/落日/薄雾来自用户提供的「类似色」色板：背景与文字沿用原值，`primary` / `accent` 保留原色相、只调明度与饱和度，使 `primary` 对 `bg` 的对比度亮色 ≥4.5、暗色 ≥7；`accent` 与 `primary` 至少保持 25° 色相差并叠加明度差，供 Logo 飘带做异色对撞。>
> **mono（曜石）** 是 2026-11-15 替换掉「青柠」的极简预设：黑白主基调 + 一支科技蓝（亮 `#2563EB` / 暗 `#5B8CFF`）。规矩是**只允许一种彩色**——`secondary` 用中性灰、`accent` 只在蓝—青同色相内延伸（`#38BDF8`，与 primary 差 25° 供 Logo 飘带对撞），不再引入第二种彩色。暗色下它额外用预设级 `textSecondary/textTertiary/textInverse` 把默认的紫灰辅助文字换成中性灰，否则「黑白」会被紫调破掉。旧值 `lime` 在老用户 localStorage 里由 `LEGACY_PRESETS`（`ThemeContext.tsx`）映射到 `mono`。

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

**文字三级的取值（2026-11-14 校准，以“看得清”为准而不是“够淡”）**：

| 变量 | 亮色 | 暗色 | 用途 |
|---|---|---|---|
| `--color-text` | 预设 `#1E1B4B` | 预设 `#EDE9FE` | 正文、标题 |
| `--color-text-secondary` | `#4B5563` | `#C4C0DA` | 说明、次级行、面板描述 |
| `--color-text-tertiary` | `#66707E` | `#A8A4C2` | eyebrow、表头、页脚注释、时间戳 |

改之前暗色是 `#9CA3AF` / `#8A8FA3`、亮色是 `#6B7280` / `#9CA3AF`，在深紫面板和玻璃层上分别只有 5.4:1 / 4.3:1 与 5.0:1 / 2.5:1，小字看着发灰。**新值在同样底色上分别是 7.8:1 / 5.8:1 和 7.6:1 / 5.0:1**；方向是"往上抬一档"，不是换色系，`body.dark` 里仍然只覆盖 sheen / ambient / flow / shadow，不碰这三行以外的颜色。

亮色下不要再往"浅白"改：亮色的底本身就是白面板 + 58% 白蒙版，白字贴上去等于消失。让亮色显得不"淡"的办法是把文字压深一档（上表），以及给压在照片上的字加浅色衬光（见 `body.has-wall:not(.dark) .vc-bookmark__label`）。

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

**左右两条边栏必须同族**（2026-11-15 统一）：左侧 `.vc-rail` 与右侧分类栏 `.vc-catnav` 都按「悬浮玻璃小板」画——`top/right(or left)/bottom: 10px` 内缩、宽 **72px**、`border-radius: var(--radius-xl)`、`1px var(--glass-border)`、`background: var(--glass-bg)`、`box-shadow: var(--shadow-sm)`、`overflow: hidden`（裁圆角）、滑入 `transform 0.3s var(--ease-out) + opacity`。右侧原有实现在 `page.css` 里贴满屏幕右边、只有一条左边框、无底色，和左 rail 差得像两个产品；统一规则写在 `global.css`，用 `.vc-catnav.vc-catnav` 双类名压过 `page.css`（后者加载在后）。分类项几何随之调整：栏宽 72、项 48 → `ITEM_LEFT = 12`、列表 `LIST_PAD_TOP = 24`（TSX 常量，勿只改 CSS）。两条边栏都接同一个指针引擎（`RAIL_SELECTOR = '.vc-rail, .vc-catnav'`），所以聚光与按钮内高光参数天然一致；激活态也统一为「`--color-primary-15` 底 + 左侧 2px `--color-primary` 竖条」，不用整块实色滑块。

**右栏的两条特殊约定**（左 rail 没有，别照抄回左栏）：
- **分类名默认隐藏，hover 才出**：`.vc-catnav__label` 绝对定位在项底（`bottom: 8px`）、默认 `opacity: 0 + translateY(4px)`，hover 时淡入；图标同步 `translateY(-6px) scale(1.06)` 让出位置。平时是纯图标列，和左 rail 的节奏一致；常显文字会让 60px 高的项里图标+文字挤成两行。
- **激活条 5px + 同色柔光**（`inset 5px 0 0 primary` + `0 0 10px primary 34%` + `1px primary 18%` 外圈）：右栏在屏幕最右侧、离视线远，2px 的细条扫一眼认不出来。这里比左 rail 粗是刻意的，不是不一致。
- 分类多到溢出时右栏内部滚动（`overflow-y: auto` + 隐藏滚动条），面板不会被撑破；`.vc-catnav__add` hover 走 `rotate(90deg) scale(1.04)`，不再用位移。
- **选中项要补偿 5px 左内边距**：激活条占的是左侧空间，图标若仍按 48px 居中会显得偏左（未选中项没有条，所以只有选中那颗"不居中"）。`[aria-pressed='true'] { padding-left: 5px }` 让图标落在「去掉激活条后的可见区域」正中。另外滑块 `left` 必须是 **11px** 不是 12px——栏宽 72 含 1px 边框，内容区居中算下来是 11，差这 1px 整块会偏右。
- **分类图标一律渲染成单色 Lucide，不用 emoji**：库里 `category.icon` 仍存自由文本（历史数据是 🏠 / 🛠 / `</>` 这类），渲染前必须过 `src/utils/categoryIcon.ts` 的 `categoryIconFor(icon, name)`——emoji → 图标映射、文本 token 兜底、认不出时按分类名猜，最后落到 `folder`。颜色**只在 CSS 里定**（未选中 `primary` 68%、选中/hover 满血 `primary`），所以换主题、切明暗自动跟随，不要在映射表里写死色值。
- **新增分类不许再让用户敲 emoji**：`CATEGORY_ICON_OPTIONS` 提供 50 个预设图标（`{ key, label, icon }`），分类管理弹窗点「图标」按钮展开 `.vc-icongrid` 网格挑选，**写库的是 key**（如 `server` / `palette`），由 `categoryIconFor` 优先按 key 解析，老数据的 emoji 继续兼容；列表行里的小图标也能点开同一个网格换图标。
- **拖拽进行中**：右栏强制 `is-visible`，所有分类项挂 `is-drop-candidate` 并临时亮出分类名（平时只 hover 出字），鼠标所悬那一项挂 `is-drop-target` 高亮。拖拽状态由 Home 的 `draggingIds` 驱动，`dragend / drop / mouseup / Esc` 四路兜底清理——元素上的 `dragend` 在拖到页面外时不一定触发，不兜底会让右栏一直卡在"可放下"。

**书签搬家（移动到分类）**：两个入口、一个动作——`PUT /nav/bookmarks/{id}` 带 `categoryId`（后端 `BookmarkUpdateRequest.categoryId` 与当前分类不同时先校验目标归属再改）。
- **图标不会因为搬家丢**：`iconType` 不传 = 保持原图标，所以移动请求只发 `title / url / categoryId`。`BookmarkSaveInput.iconType` 已改为可选，别顺手补 `auto`，那会触发重新抓图标。
- **右键菜单**：书签菜单里点「移动到分类」就地切成同坐标的分类子菜单（`menu.kind = 'bookmark-move'`），自动排除当前分类；右键那颗若在多选集合里，移的是整批（菜单文案带数量）。
- **框选 + 拖拽**：网格空白处按下拖出 `.vc-bookmark-band`，松手选中相交图标；空白单击清空。图标上按 `Ctrl / Cmd / Shift` 是加选而不是打开链接。拖一个已选中图标 = 整批走，拖未选中的只走它自己。
- 切分类自动清空 `selectedIds`；后端不改 `sortOrder`，来回搬一次顺序能原样恢复（已实测）。

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

**弹窗（Modal）**
- **标题区不要背景**：主题 token 里 `Modal.headerBg = surface`，玻璃模式下 surface 是半透白，会在深色玻璃弹窗上贴出一条浅色 header 带，标题右侧还被关闭按钮压住（真实踩过）。`global.css` 已统一覆盖为 `.ant-modal .ant-modal-header { background: transparent }`，并给 `.ant-modal-title` 留 `padding-right: 44px` 的安全距离。以后不要再用 token 给 header 上色。
- 关闭按钮保持 antd 默认（`absolute; top/right 8px`、40×40）；要拉开距离靠标题内边距，别单独挪关闭按钮，否则窄弹窗会贴到圆角。

**Toast（antd `message`）**
- antd 的 message 走 CSS-in-JS，注入时机在 `global.css` 之后；**同权重规则会被它盖掉**，光写 `body.dark .ant-message-notice-content` 只能改到文字色，底色仍是 antd 的白色 → 深色主题下变成“白底浅字”，几乎看不见（真实踩过）。
- 现在由 `global.css` 末尾一段统一锁死（`!important`）：底 `--color-surface-elevated`、字 `--color-text`、边 `--color-border`、`border-radius: 10px`，图标按类型单独上色（success `--color-success` / error `--color-error` / warning / info+loading `--color-primary`）。改主题、切明暗自动跟随，别在组件里给 message 写死颜色。
- 新增别的 antd 浮层（notification / dropdown）时同理：先假设 CSS-in-JS 会压过全局样式，用 `!important` 或更高权重（双类名）验证过再说。

**Segmented / Tab（胶囊）**
- 容器 `padding 4` + `radius 999` + `colors.surface`；滑块 `position absolute; left 4; width calc(50% - 4px); background colors.primary; transform translateX(100%)`；`transition transform .28s cubic-bezier(.4,0,.2,1)`；激活项文字在亮色 `#fff`、暗色 `#14102B`。
- 面板切换用 `.vc-tab-pane`（`global.css` 已有入场动画），不要自造。

**表格（管理端）**
- 外层用 `.vc-panel.vc-table-card`，表格 `.admin-table`；表头 13px/600、行高 48、hover 行 `colors.primary10`。
- 表格容器自带**边缘聚光**：1px 品牌紫渐变描边（`::before` + mask 只留描边）+ 外侧低强度扩散 + 顶部内高光，颜色全部由 `--color-primary` 派生，亮/暗/玻璃自动适配；页面内不得再自写描边或阴影覆盖。
- 列表页统一 `.vc-page--list` + `.vc-table-card--fill` + `.vc-table-fill`：整屏高度、表体内部滚动、表头吸顶；`pagination={false}`，下滑用 `useInfiniteRows` + `ListSentinel` 懒加载。

**配置表单（系统配置类页面，2026-11-19）**
- 一屏表单统一走「左标签列 + 右控件列」两列栅格：标签列定宽 **236px**（标题 14/600 + 说明 12/1.7），控件列自适应但统一限宽 **520px**，所有控件共用同一条左边缘与右边缘。参考实现 `pages/Admin/Config.tsx` + `pages/Admin/config.css`（`.vc-config-row`，作用域 CSS 单独放文件，不写进 `page.css`）。
- **不要**把横向的「标签 + 控件」塞进 `.vc-setting-row`：该类是 `flex-direction: column`，是给外观页的「标题在上、滑块在下」用的；横向表单进去后会变成标签在上、控件紧贴其下，且每个控件各写宽度（旧版系统配置页就是这样参差的）。
- 开关行用 `.vc-config-switch`（开关 + 当前状态文案，`min-height: 40px`）与单行控件基线对齐；主题色板复用全站 `.vc-theme-item / .vc-theme-swatch`（外观页同款），不再造第二套色块。
- 设置类页头关掉流光（`<PageHeader flow={false} />`）；撤销 / 保存放 `extra`，有改动才启用保存，并在操作区挂「有未保存的更改」提示；保存过程中只出顶部 2px `.vc-slim-progress`，不整块 `<Spin />` 替换。
- ≤720px 栅格折叠为单列（标签回到控件上方、控件占满宽度）。

**图标**
- 一律 `@iconify/react` + `@iconify-icons/lucide`（已安装）；尺寸 16（行内）/ 20（rail、工具卡）/ 22（大按钮）。不要引第二套图标库。

**知识库目录树（`pages/Knowledge/DocTree.tsx` + `tree.css`，2026-11-15）**
- 结构：antd `Tree`（`blockNode` + `titleRender`），虚拟根节点「全部文档」常展开、不可拖；目录行 = folder 图标 + 名称 + 递归 `docCount` 徽标；文档行 = file 图标 + 标题 + `zap` 向量标记 + 相对时间。
- 行高 **30px**、缩进 14px、圆角 `--radius-sm`；选中态用 `--color-primary-15` 底 + 左侧 2px `--color-primary` 竖条（不用实底填充，避免和玻璃层打架）。
- 拖拽落点：拖到目录内部 → 整行 `--color-primary-15` 高亮 + 1px `--color-primary-30` 描边；拖到 gap → `.ant-tree-drop-indicator` 画的 2px 插入线（只动 `transform/opacity`，禁止改 `layout`）；被拖节点 `opacity: .5`。
- 右键菜单（`TreeContextMenu.tsx`）是**独立 fixed 浮层**（挂在 body 外），不是 antd `Dropdown`：`--glass-bg` + `--glass-border` + `--shadow-lg`，行高 32、120ms `--ease-out` 入场（`opacity + translateY(-4px)`），贴视口边缘自动翻转。
- 文本命中高亮 `.vc-tree__hit`：`--color-primary-30` 底 + `--color-primary` 字，只高亮标题内的关键词片段。
- ⚠️ 样式写在独立 `tree.css` 并 `.vc-tree` 作用域，**不往 `page.css` 里加**（该文件体量大、多人同时在改）。
- **侧栏头部只放两个主按钮**（新建 / 导入），次级动作走悬停滑出面板（`.vc-kb-action`）：面板定位在按钮下方 6px、`opacity + translateY(-6px)` 140ms 滑出，`visibility` 参与过渡以免闪现；面板与按钮之间用 `padding-top` 留出「悬停桥」，鼠标下移不会中断；右侧按钮的面板加 `--end` 修饰类右对齐，避免越出 280px 侧栏。第三个图标按钮被压成 24px 方块是反例，不要再加。
- **浮层必须不透明**：`--glass-bg` / `--color-surface-elevated` 在毛玻璃模式下都是半透明的，浮层叠在密排文字（树行、列表）上会透底、小字发糊。标准做法是「实心打底 + 半透明抬升」——
  `background-color: var(--color-bg); background-image: linear-gradient(var(--color-surface-elevated), var(--color-surface-elevated));`
  合成结果不透明但保留抬升质感，两种主题都成立。右键菜单（`.vc-tree-menu`）同理。
- **流式回复的打字机**：SSE token 是成批到达的，直接铺 DOM 会「一顿一顿」跳字。统一用 `hooks/useTypewriter.ts`：维护一个与内容长度解耦的播放进度，每帧按时间推进；速率取 `max(基础 70 字/秒, 积压/1.4s)`，即**一次积压至少摊到 1.4 秒吐完**——这条下限是必须的：模型常首 token 慢（4~8s）、随后整段瞬间到达，没有它用户看到的是「等很久 → 一次性显示」。流结束（`active=false`）时不硬对齐：剩余 ≤200 字让循环照常吐完，超过才直接落地。渲染层按 ~30fps 节流（每次 setState 都重解析一遍 Markdown），追平那帧强制落地。末尾挂 `.vc-msg__caret` 闪烁光标（`typing = active || 还在补字`），`prefers-reduced-motion` 下全部关闭。**取消 rAF 后必须把 `rafRef` 置空**，否则 React StrictMode 的 mount→卸载→再 mount 会让循环被误判「已在跑」而不重启，整条回答一直空白到流结束。
- **SSE 帧安全**：`data:` 里不能出现裸换行。后端 `ChatController` 把 token 编成 `event: token` + `data:{"t":"..."}`（换行成 `\n` 转义），前端按事件名分流、`JSON.parse` 取 `t`，解析失败才回落裸文本。历史上直接 `data(token)` 时，换行 token 写出 `data:\n\n\n` 会切坏帧——多行回答被拼成一整段、正文零星丢字。
- **单换行保留**：`global.css` 里 `.vc-msg .md-body p/li` 用 `white-space: pre-wrap`。Markdown 语义里单换行等于空格，但对话里模型常用单换行分行，不保留会读成一行长文。
- **「正在查看」与「导出选集」是两套状态**（`DocTree.tsx` + `tree.css`，2026-11-15）：
  - **正在查看** = `activeDocId` / `activeFolderId`，渲染时给对应节点塞 `className: 'vc-tree-node--current'`。⚠️ antd 把 `DataNode.className` 打在 `.ant-tree-treenode`（外层 li）上，不是 content-wrapper，选择器必须写 `.ant-tree-treenode.vc-tree-node--current > .ant-tree-node-content-wrapper`。样式是左侧 2px 竖条 + 标题提亮：**用 `box-shadow: inset 2px 0 0 0 var(--color-primary)` 画**，行有 1px 圆角，阴影会顺着圆角收成一小段弧、贴着行左端轮廓走——这是用户明确拍板的形态（试过直上直下的 `::before` 竖条被否了，别再改回去）。
  - **导出选集** = `selectedKeys`，只有 Ctrl / ⌘ 点击文档才增删，且 **Ctrl 点击不切换文档**（攒批时别被迫跳来跳去）。普通点击 = 打开文档 + **清空选集**；点文件夹 = 切落点 + 清空选集；右键不动选集。两套状态可同时存在（当前行也能被 Ctrl 选中）。
  - 选集变化通过 `onSelectionChange` 上报篇数，导出面板那条显示 `已选 N 篇` 徽标，`N=0` 时按钮 `disabled`（`tree.css` 里 `.vc-kb-action__item:disabled` 压到 0.45 + 禁止光标）。
  - 批量导出「选中文件」由 `getSelectedDocIds()` 直接读这份选集，与「当前打开哪篇」彻底解耦。
  - 验法：`dispatchEvent(new MouseEvent('click',{bubbles:true,ctrlKey:true,metaKey:true}))` 合成 Ctrl 点击，数 `.ant-tree-node-selected` 与 `.vc-tree-node--current` 各自的条目；导出则真点一次「批量导出选中文件」，看 zip 文件名里的篇数。
- **目录（TOC）点击跳转不能和滚动监听抢高亮**（`DocEditor.tsx`，2026-11-15）：点目录项 = `setActiveId(id)` + `scrollIntoView({behavior:'smooth'})`，而 `.doc-editor-scroll` 的 `onScroll` 会用「标题距容器顶 > 96px 就 break」的规则逐条重算当前标题。平滑滚动期间 scroll 事件每帧一发，重算会连续覆盖点击设定的目标项 → 高亮在中间几个标题之间来回跳，落地后再被末帧算出的值甩到别的项上。修法：点击时写 `lockIdRef` 并立即 `setActiveId`，`handleScroll` 见锁直接 return（同时把「解锁」计时器每次 scroll 重置 240ms，滚动停稳才放开）；用户 `wheel` / `touchstart` 立刻解锁交还控制权，否则高亮会被钉死，手感更糟。要验这条不能靠自动化标签页——那里 rAF 被暂停，`behavior:'smooth'` 根本不推进；用分段改 `scrollTop` + 手动派发 `scroll` 事件模拟事件流，再挂 `MutationObserver` 记录 `is-active` 变化次数。

---

## 8. 动效

**允许的类型**：位移（≤ 20% 容器尺寸）、缩放（0.94–1.28）、透明度（0.3–1）、`backdrop-filter` 的轻微呼吸、颜色渐变。
**禁止**：改 `width/height/top/left` 做动画、`filter: blur()` 大范围动画、无限旋转的装饰元素、同屏 >2 组常驻动画。

**时长表**：hover 150ms / 状态切换 250ms / 面板进出 400ms / 环境光漂移 4–12s（多段 keyframes，首尾同值才能无缝循环）。

**首屏书签悬停上浮（2026-11-15）**：`.vc-bookmark:hover .vc-iconpreview` → `translateY(-6px) scale(1.04)`，`transition: transform var(--duration-fast) var(--ease-out)`；只动图标不动底块背景，否则整块会跳。规则写在 `styles/global.css`（`page.css` 由用户维护，不插）。`prefers-reduced-motion` 下关闭。注意 `.vc-iconpreview` 只在此处位移，弹窗预览（`--plain`）不受影响。

**悬停时底块不能“框住”上浮的图标**：图标抬起 6px 后会顶到 hover 底块的上边缘，看着像撞框。所以 hover 不铺实底，改成 `linear-gradient(to top)`：底部保留原浓度（普通模式 `primary 10%`、壁纸模式 `rgba(255,255,255,.13)`），30% 起渐隐、78% 处全透明，图标像从底部的光雾里浮出来。必须用双类名 `.vc-bookmark.vc-bookmark:hover` / `body.has-bg .vc-bookmark.vc-bookmark:hover` 才压得住 `page.css` 里等权重的 `.vc-bookmark:hover`。

**左侧 rail 边缘流光（2026-11-15 二次修正）**：**不要用 `conic-gradient` 转角度给细长容器画流光**。rail 是 72×870，conic 的角度映射到实际边长极不均匀——顶/底那两条 72px 短边几度就被扫完，整条短边一次全亮，看着像“流光在顶部/底部被拉长”，只有左右长边是正常渐变光带（真实踩过）。改成“按边跑”：`::after` 保留 `content-box` XOR 的 1px 环遮罩，`background-image` 三层——① 整圈 `color-mix(primary 32%, transparent)` 底光（顶/底只靠这层，不扫动）；②③ 沿左右长边的 1px 光带，`background-size: 1px 300%` 撑出 3 倍高画布、band 放在画布 34%~45%，靠 `background-position` 百分比位移（`p × (容器高 − 画布高) = −2pH`）把 band 从下沿送到上沿，左向下、右向上，`@keyframes vc-rail-beam` 只动 `background-position`。因为 band 长度按像素定死，所以走到哪儿都一样长。hover 仍走 `opacity: 1` + `animation-duration: 2.8s`。

**左侧 rail 聚光跟随（2026-11-15）**：复用 `utils/pointerGlow.ts` 的指针引擎（不另起监听），新增第三种目标 `rail`：`.vc-rail` 上写 `--glow`（强度）/`--glow-x`/`--glow-y`（元素内 px，钳制在栏内），CSS 用 `.vc-rail::before` 画 `132px` 主色 radial（核心 38% → 44% 处 16% → 74% 透明），`opacity: calc(var(--glow) * 0.95)`。**`::after` 已被流光描边占用，聚光只能用 `::before`**；`z-index:0` + 按钮自身 `position:relative`，光在按钮底下、玻璃底之上。指针在栏内满亮、出栏 40px 内渐隐（避免贴边忽明忽暗）；壁纸模式补一层白晕。**被压住的那颗按钮再单独打一层内侧高光**：引擎命中 `.vc-rail__btn` 后写 `--btn-glow` / `--btn-x` / `--btn-y`（按钮内 px），CSS 用 `.vc-rail__btn::before` 画 `58px` radial + `inset 0 0 0 1px primary 26%` 内描边；换按钮时把上一颗的 `--btn-glow` 归零（不能只靠 `:hover`，光点要在按钮内跟着指针走）。

**常驻光效（2026-11-14 新增，v1）**——内页"静止帧也有光"的唯一手段，参数只有一组令牌：

| 原子 | 落点 | 配方 | 令牌 |
|---|---|---|---|
| 环境光 | `.vc-shell__canvas::before` | 两团 radial（左上 primary / 右下 secondary，`color-mix` 取 26%），9s 呼吸 0.7×~1×，只动 opacity | `--ambient-opacity / --ambient-duration / --ambient-tint` |
| 页头流光 | `.vc-page-head::before` + `::after` | `::before` 3px 静态渐隐线（圆角 2px，2026-11-14 由 1px 加粗）；`::after` 34% 宽带高光 11s 从画外走到画外（首尾都在画面外 → 无接缝）。**设置类子页用 `<PageHeader flow={false} />` 关掉**（窄内容列里的短横线像多余的划线） | `--flow-duration / --flow-opacity / --flow-band` |
| 统计脉搏 | `.vc-stat::before` | 左下 radial 主色 26%，8s 呼吸 0.18→0.3，`z-index:-1` 在卡片底色之上、正文之下 | 复用环境光令牌，无独立参数 |

三条硬规则：
1. **常驻动画同屏 ≤2 组**：环境光 + 页头流光已占满，别再加第三组循环动画。
2. **降级时不降到 0**：`prefers-reduced-motion` 下环境光保留 `opacity .32` 的静态底光，否则整页突然变扁平；页头流光则直接 `opacity:0`。
3. **壁纸模式必须出白色变体**（`body.has-bg`），紫色光压在用户照片上会显脏。

> 详细数值验收与调参见 `docs/frontend-visual-polish-v1.md`。

**指针聚光（2026-11-14，v1.3）**——"靠近才亮"的近场反馈。**首屏只管书签图标，内页才有面板级光环**：

| 项 | 规则 |
|---|---|
| 数据来源 | `src/utils/pointerGlow.ts` 单实例，全局 `pointermove` → 一帧一次 rAF，矩形缓存（resize/scroll/DOM 变动才重建） |
| 只写两个变量 | `--glow`（0~1）、`--glow-angle`（deg，指针方位） |
| 两类目标 | **卡片** `.vc-bookmark`（只在首屏）：smoothstep(离边缘/130)，无基线，离开就熄。**面板** `.vc-panel:not(.vc-stat)` + 弹窗：smoothstep(离边缘/440) + **基线 0.32**，方位每帧 0.18 缓动 → 光沿边框"流"而不是闪 |
| 首屏边界 | **不给 `.vc-bookmark-grid-wrap` 画整框**：容器固定 4 行高，框上去就是一大块空盒子，比图标更抢眼 |
| 画法 | conic 渐变 + `mask: content-box / exclude` 只留一圈；面板/弹窗收窄成 ±30° 短光段（弧越宽越像"这侧边框变色"） |
| 必带降级 | 触屏 `(hover: none)` 全关；壁纸模式换白光；`prefers-reduced-motion` 取消缓动（`easeFactor=1`）直接跳位 |

三条硬规则之外再加两条：**别用 `:hover` 冒充"靠近"**（`hover` 只有进出两态，给不出距离）；**面板级聚光必须有基线 + 缓动**（面板只有一个、面积又大，没有基线就是"看不见的一帧静止光"，没有缓动就是"闪一下"）。



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
    ├ .vc-login__orbit     ±4° 缓慢摇摆的容器（12s）
    │  └ .vc-login__aurora 指针视差层（--lg-mx/--lg-my，18px/14px）
    │     └ .vc-login__blob--a/b/c/d  4 团彩色光斑（5s/5s/7s/4s，位移 12–20% + scale ≤1.28，峰值 opacity .26–.44）
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
| 只做 hover / 入场特效，没有常驻光 | 静止画面一帧不动，页面显得"素"、像静态稿 | 加 §8 的环境光（`--ambient-*`），这是"活"的底座 |
| 用 `:hover` 冒充"鼠标靠近" | 只有进出两态，鼠标在旁边但没进入时毫无反馈 | 用 `pointerGlow` 的 `--glow`（距离 → 亮度） |
| 在 `pointermove` 里直接 `getBoundingClientRect()` | 每个事件强制 layout，列表一划就掉帧 | rAF 合帧 + 矩形缓存 + 变化阈值 |
| 面板级聚光没有基线、没有缓动 | 弹窗只有一个、面积大，指针一停就是"一帧静止光"，用户会判定"没做" | 基线 `0.32` + 方位每帧 `0.18` 缓动（登录表单卡同配方） |
| 把光圈画在固定高度的容器上 | 网格留白区被圈进去，凭空出现一个"空盒子"，比内容还抢眼 | 首屏只给图标，不给容器；面板只给真正有边界的分区 |
| 玻璃侧栏里沿用 `--color-text-secondary` | 暗色 / 壁纸下多层透明叠起来，菜单字发灰、看不清 | 侧栏文字取 `color-mix(--color-text 78%)`，仍低于选中态 |
| 变量下标硬编码 z-index | 弹层被遮挡、改一处崩一片 | 用 `--z-*` 令牌 |
| 整页滚动 + 内部再滚动 | 双层滚动条、移动端卡顿 | 外层 `overflow:hidden`，内层单点滚动 |
| 不同组件复用同一个类名（`.vc-suggest` 既是 Chat 竖排块又是搜索联想行） | 后定义的那份只覆盖一部分，没覆盖的 `flex-direction: column` / `max-width` 全部残留，行变成居中的一摞 | 组件级独享命名空间：`vc-search__sug*`，样式块的注释里写清"不要再叫 X" |
| Dock 放大只给被 hover 的图标加 `scale` | 放大出来的宽度压到邻居身上，图标互相叠、看着像错版 | 放大与位移分开：高斯衰减算 `scale`，按新宽度重算中心差写 `--dock-dx`，整条对称撑开 |

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
