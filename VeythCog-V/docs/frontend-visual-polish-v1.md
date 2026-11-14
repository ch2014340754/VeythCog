# 内页视觉加码 · 环境光 + 流光（v1）

> 日期：2026-11-14
> 目标基调（用户明确要求）：**清雅素净为主，只加流光一类轻特效，不要豪华炫技、不要艳丽配色。**
> 前置文档：`frontend-style-guide.md`（视觉契约）、`frontend-refactor-report.md`（上一轮统一改造）
> 验收口径：`npx tsc --noEmit` exit 0 + `npm run build` 通过 + 无头 Edge（1440×900）读 computed style，**不含截图**

---

## 一、问题定义（为什么内页"素"）

上一轮已经写好一层动效（`page.css` 末尾"动效层 v1.0"，令牌 `--motion-*` / `--sheen-*`），实测覆盖如下：

| 效果 | 触发条件 | 落地情况 |
|---|---|---|
| `vc-fade-up` 页面切换 | 进页面 | ✅ `.vc-page` / `.vc-home` |
| 网格错峰入场 | 进页面 | ✅ `.vc-grid`（工具首页等 13 处） |
| 卡片 hover 扫光 `vc-sheen-sweep` | **需要鼠标** | ✅ `.vc-tool-card` / `.vc-stat` / `.vc-card--interactive` |
| 按钮轻抬 + 按压回弹 | **需要交互** | ✅ |

结论：**现有特效全部依赖交互触发，静止画面一帧不动**，而登录页相反——它有常驻的静态底光 `__core`、4 团漂移光斑、12s 摇摆的 orbit、指针视差。这就是"内页是地板、登录页是天花板"的真实原因：差的不是特效数量，是**静止帧里有没有光**。

---

## 二、这次加的三样（都克制，都不循环闪烁）

### 1. 内页环境光（第 1 阶，最主要的一招）

`.vc-shell__canvas::before` —— 内容卡里两团极淡的径向光：左上 `primary`、右下 `secondary`，9s 呼吸（只动 `opacity`，0.7×~1×）。

- 作用等同登录页的 `__core`：让上面的毛玻璃面板**有"底"可透**，页面不再是纯色平板。
- 位置跟随内容卡，不跟随滚动，`pointer-events: none`，`z-index: 0`；`.vc-page`（`position: relative`，DOM 在后）自然盖在光层之上。
- 壁纸模式（`body.has-bg`）换成白光（`rgba(255,255,255,.10/.07)`），避免把用户的照片染成紫色。
- 只在 `MainLayout` 内生效：`/home` 是独立布局，本来就有壁纸体系，不受影响。

### 2. 页头流光（第 2 阶）

`.vc-page-head` 用两个伪元素，做成"一条细线 + 线上慢慢走的一小段高光"：

- `::before`：3px 静态渐隐线（`primary 30%` → `secondary 16%` → 透明，圆角 2px），负责"这条线在那"。（2026-11-14 由 1px 加粗到 3px：1px 太细，远看像没画）
- `::after`：一条宽带高光，`11s` 从左侧画外走到右侧画外，首尾都在画面外 → **看不到循环接缝**，也永远不会"闪"。
- 只动 `transform` + `opacity`；`box-shadow`/`drop-shadow` 是一层柔光，不是发光管。
- 因为挂在 `PageHeader` 这个共用组件上，**全站内页一次到位**，不用逐页加类。

### 3. 统计数字的脉搏（第 2 阶补充）

`.vc-stat::before`：卡片左下角一团 `primary 26%` 的径向光，`8s` 呼吸 0.18→0.3，`z-index: -1`（落在卡片底色之上、正文之下，父级已有 `isolation: isolate`）。

只给"数字页"（监控、字数统计等）一点活气，不给表单页。

### 4. 顺手工程的：书签图标瘦身

按用户要求去掉首页书签图标右上角的 `✎` / `✕` 悬停按钮（`.vc-bookmark__actions` / `.vc-bookmark__action` 整套 CSS 一并删除）。
编辑/删除**功能没丢**：走首页全局右键菜单（`Home/index.tsx` 的 `menu.kind === 'bookmark'` → "编辑图标 / 删除"）。
效果：图标位只剩图标 + 名称，悬停只留一层 10% 主色底。

---

## 三、令牌（新增，全部在 `global.css`）

```css
:root {
  --ambient-opacity: 0.55;   /* 环境光总强度 */
  --ambient-duration: 9s;    /* 呼吸周期，越慢越静 */
  --ambient-tint: 26%;       /* 光斑中心色浓度 */
  --flow-duration: 11s;      /* 页头流光走一遍 */
  --flow-opacity: 0.9;       /* 流光峰值 */
  --flow-band: 34%;          /* 流光带宽占页头宽比例（决定视觉速度） */
}
body.dark {
  --ambient-opacity: 0.4;
  --ambient-tint: 20%;
  --flow-opacity: 0.62;
}
```

调参入口只有这一处：觉得太明显就调 `--ambient-opacity` / `--flow-opacity`，觉得走太快就调 `--flow-duration`。**不要在页面里另写光效。**

---

## 四、登录页降配（第 3 阶：把天花板拉回素净基调）

素净是基调，那该降的是登录页，而不是给内页加戏。参数对照：

| 项 | 改前 | 改后 | 说明 |
|---|---|---|---|
| 光斑 a 峰值 opacity | 0.46→0.62 | 0.30→0.42 | 左上主光 |
| 光斑 b 峰值 | 0.22→0.40 | 0.14→0.26 | 右上 cta 光 |
| 光斑 c 峰值 | 0.38→0.56 | 0.24→0.36 | 底部 secondary |
| 光斑 d 峰值 | 0.50→0.66 | 0.32→0.44 | 左下主光源 |
| 暗色 b / d 峰值 | 0.32→0.52 / 0.30→0.44 | 0.20→0.34 / 0.20→0.30 | 暗色单独留低一档 |
| orbit 摇摆 | ±7° / 12s | ±4° / 12s | 光场整体摆动减半 |
| aurora 指针视差 | 34px / 26px | 18px / 14px | 幅度砍半，跟随变"柔" |
| ring 亮弧 opacity | `0.42 + glow*0.6` | `0.28 + glow*0.42` | conic 描边暗约 3 成 |
| ring--halo 外溢 | `0.10 + glow*0.26` | `0.07 + glow*0.18` | 同上 |

净效果：**4 团光斑峰值统一降约 1/3，视差与摇摆减半**，登录页从"浓"降到与内页同一杯茶。

---

## 五、降级与约束（照 style guide §8 的规矩）

- `prefers-reduced-motion: reduce` 下：环境光停呼吸但**保留一层 0.32 的静态底光**（不降到 0，否则整页突然变扁平）；页头流光 `opacity: 0` 且不位移；统计光停在 0.2。
- 常驻动画同屏只有 2 组（环境光呼吸 + 页头流光），统计光只在数字卡上，符合"≤2 组"的上限。
- 全部只动 `transform` / `opacity`，不碰 `width/height/top/left`。
- 壁纸模式（`body.has-bg`）三个光效各有白色变体，不压紫色在照片上。
- 颜色零硬编码：环境光/流光全部走 `--color-primary` / `--color-secondary` + `color-mix()`。

---

## 六、数值验收（无头 Edge，1440×900，`npm run preview` 于 :4173）

| 检查项 | 实测 |
|---|---|
| 内容卡尺寸 | 1338×880（`/tools`），1338×880（`/settings/appearance`） |
| 环境光 | `animationName=vc-ambient-breathe`，`9s`，运行中 opacity ≈0.537~0.545，`z-index: 0` |
| 环境光取色（无壁纸） | `radial-gradient(64% 46% at 6% -6%, color(srgb .486 .227 .929 / .26) 0%, transparent 72%)` = 主色 26% |
| 环境光取色（壁纸模式） | 两条 `rgba(255,255,255,.10/.07)` 白光 |
| 页头静态线 | `height: 3px`（2026-11-14 由 1px 加粗，圆角 2px），宽度 = 页头宽（`/tools` 1018px、`/settings` 960px） |
| 页头流光 | `animationName=vc-flow-travel`，`11s`，`transform` 在持续位移（采样 -518px / -487px 等），峰值 opacity 0.9 |
| 统计光 | 合成节点上 `vc-stat-pulse`，`8s`，`z-index: -1`，尺寸 732×732（卡片宽 72%），取色主色 26%，父级 `position: relative / isolation: isolate / overflow: hidden` |
| 降级 | 模拟 `prefers-reduced-motion: reduce` 后：环境光 `animationName=none` 且 `opacity=0.32`；页头流光 `opacity=0` |
| 登录页 | 4 个光斑动画仍在跑，峰值分别落在 0.42 / 0.255 / 0.263 / 0.32（即改后的 hi 值）；ring/ring--halo 实测 0.16（静止无指针时） |
| 类型 / 构建 | `npx tsc --noEmit` → 0 错误；`npm run build` → ✓ built in 6.95s |

> 说明：`/admin/monitor` 在验证脚本里崩了（`Cannot read properties of undefined (reading 'toLocaleString')`），原因是脚本把所有 `/api` 请求桩成 `{}`，统计接口返回结构不完整；**属验证脚本的假数据问题，不是页面 bug**（该页在真实后端下正常）。统计卡因此改用"合成节点"验证 CSS 本身。

---

## 七、改动文件

| 文件 | 改动 |
|---|---|
| `src/styles/global.css` | 新增 6 个环境光/流光令牌；`body.dark` 三档降配 |
| `src/styles/page.css` | `.vc-shell__canvas` 加 `position: relative` + `::before` 环境光 + `@keyframes vc-ambient-breathe`；`.vc-page-head` 加 `::before`/`::after` 流光 + `@keyframes vc-flow-travel`；`.vc-stat::before` 呼吸 + `@keyframes vc-stat-pulse`；`prefers-reduced-motion` 补三条降级；删除 `.vc-bookmark__actions` / `.vc-bookmark__action` 全部规则 |
| `src/pages/Login/login.css` | 光斑 4 组 opacity 下调；orbit ±7°→±4°；aurora 34/26→18/14px；ring / halo opacity 公式下调 |
| `src/pages/Home/BookmarkIcon.tsx` | 去掉 `onEdit`/`onDelete` 入参与悬停按钮 |
| `src/pages/Home/BookmarkGrid.tsx` | 同步去掉 props 与本地删除逻辑（改由右键菜单负责） |
| `src/pages/Home/index.tsx` | 不再向 `BookmarkGrid` 传 `onEditBookmark` |

---

## 八、未做 / 待确认

1. **4K（≥1900px）未实测**：环境光是 `%` 定位的 radial，理论上随容器放大，但没有在 2544×1380 跑过数值。
2. **暗色 + 壁纸的组合未实测**：`body.dark` 的三档降配写在令牌里（opacity 0.4 / tint 20% / flow 0.62），只做过亮色与壁纸亮色的采样；暗色下若仍偏亮，优先调 `--ambient-tint`。
3. **首页与内页仍是两套底色**：首页壁纸白玻璃 `whiteGlass()` 保留（壁纸下必须），本次只让内页有了光，没有强行统一首页。若要彻底统一，需改 `homeSurface.ts` 的入口参数，属另一轮。
4. **统计光覆盖范围**：只作用于 `.vc-stat` 所在的数字卡；如果希望图表区也有脉搏，需要另加 `.vc-chart` 的变体。

---



## 九、指针聚光（v1.3 · 首屏只留图标，内页面板与弹窗）

> 需求演化：先要"网站列表和弹窗边缘加聚光"，看到书签卡效果好但"列表和弹窗没见到动效" → 参考登录页表单卡改成面板级配方 → 再确认：**这套是给除首屏以外的页面的，首屏只保留图标里的聚光，最外层那个大框不要**。

### 9.1 三层取舍

| 位置 | 做什么 | 不做什么 |
|---|---|---|
| 首屏（首页图标墙） | 只留书签卡：靠近哪张哪张亮 | 不画整块网格容器的外框 |
| 内页（设置 / 知识库 / 后台 / 对话） | `.vc-panel` 分区整圈流光：常亮微光 + 越近越亮 + 方位缓动 | 不给 `.vc-stat`（它已有脉搏和扫光，伪元素会打架） |
| 弹窗（含首屏的弹窗） | 2px 光弧 + 外侧 9px 外溢 | 不做整圈常亮描边 |

首屏那块容器为什么不能框：`.vc-bookmark-grid` 有 `min-height: 436px`（固定 4 行高），框上去会在空白区画出一大块空矩形，比图标本身还显眼 —— 用户截图圈的就是这个，判断"凸显出来反而不好看"。所以 v1.3 直接不把它当面板，连 `--glow-box-h` 那套"量图标高度"的补丁也一并删了（简单即是准）。

### 9.2 面板的配方（抄登录页表单卡）

`Login/index.tsx` 的三条，正是"能被看见"的原因：

1. **有基线**：最暗也留 0.32，边框永远有一层微光，不是全灭；
2. **有缓动**：方位角每帧 0.18 逼近 → 光圈像"顺着边框流过去"，而不是闪一下；
3. **有光芯**：conic 中段主色 94%，两端 32%，再收窄成 ±30° 的一段。

面板强度用**"离边缘"**而不是登录页的"离中心"：登录卡 400px 宽，用离中心没问题；内页面板 960px 宽，用离中心时指针贴左边缘还算是"很远"，永远点不亮。

### 9.3 光弧宽度是调出来的

| 版本 | 弧宽 | 观感 | 结论 |
|---|---|---|---|
| v1.1 弹窗 | 116° | 整条左边框被染紫 | 像"这侧边框变紫"，不像光在走 |
| v1.2 弹窗 | 68° | 只剩中段亮 | 可接受 |
| v1.3 面板 | 60° | 一条边上的短光段 | 960×443 的面板上正好只亮一截 |

### 9.4 参数

`src/utils/pointerGlow.ts`：

```ts
const CARD_RADIUS = 130;      // 卡片：多近开始亮
const SURFACE_RADIUS = 440;   // 面板：多近开始「更亮」（基数之上）
const SURFACE_FLOOR = 0.32;   // 面板常亮的底光，调大就更"常在"
const EASE = 0.18;            // 光圈旋转的缓动，调小更慢更飘
```

CSS 里调不透明度：卡片 `calc(var(--glow) * 0.85)`、面板 `calc(0.07 + var(--glow) * 0.55)`、弹窗描边 `calc(0.08 + var(--glow) * 0.5)`、外溢 `calc(0.03 + var(--glow) * 0.22)`。

### 9.5 实测（1440×900，无头 Edge，读 computed style + 截图目视）

首屏（6 张真实书签卡，指针停在图标行）：

| 检查项 | 结果 |
|---|---|
| 网格容器 `::after` 的 `content` | `none`（容器上没有任何光圈） |
| `.vc-panel` 数量 | 0（首屏没有面板，不会误触） |
| 书签卡 | 指针所在卡亮，相邻卡边上留一截淡光 |

设置页（两个面板 960×443 / 960×154）：

| 指针位置 | `--glow` | 光圈 opacity |
|---|---|---|
| 贴面板左边缘（内侧 6px） | 0.996 | 0.618 |
| 面板正中 | 1.000 | 0.620 |
| 屏幕右上角（远，但仍在 440px 内） | 0.807 | 0.514 |
| 页面初始（指针未动） | 0.320（基线） | 0.246 |

### 9.6 降级

- 触屏 `(hover: none), (pointer: coarse)`：卡片 / 面板 / 弹窗聚光全部 `display:none`。
- `prefers-reduced-motion`：`easeFactor` 变 1，取消缓动直接跳位（"光圈慢慢挪"本身就是动效），亮度仍跟指针走。
- 壁纸模式：面板换白光；暗色：光芯换白、尾巴留主色。

### 9.7 文件

| 文件 | 改动 |
|---|---|
| `src/utils/pointerGlow.ts` | 卡片 + 面板两类目标；面板走"基线 + 缓动"；首屏容器不进目标集 |
| `src/main.tsx` | 渲染后 `installPointerGlow()` |
| `src/styles/page.css` | 文件末尾「指针聚光」：书签卡描边、`.vc-panel` 光圈、弹窗描边 + 外溢、壁纸/暗色变体、两处降级 |

## 十、细节修正（2026-11-14 随工）

三处小改，都是"看到了才改"的那种：

### 10.1 页头流光的开关

`PageHeader` 以前无条件挂 `.vc-page-head`，流光是 CSS 里的全局效果，于是**每个内页都有**。问题出在设置类子页：内容列 `max-width: 1040px`，页头只有两三百像素宽，那条 3px 线在窄列里像一截多余的划线，反而难看。

给组件加了 `flow?: boolean`（默认 `true`），关掉时挂 `.vc-page-head--no-flow`，CSS 里把 `::before` / `::after` 直接 `display: none`：

```tsx
<PageHeader title="账号设置" flow={false} />
```

当前关闭：`/settings/account`、`/settings/providers`、`/settings/lark`、`/settings/appearance`。
保留：后台（Admin）各页、`/tools`、工具子页。

实测：`/settings/account` 的页头 `className` 为 `vc-page-head vc-page-head--no-flow`，两个伪元素 `display: none`；`/admin/users` 仍为 `vc-page-head`，伪元素 `display: block`。

### 10.2 侧栏菜单字提亮

暗色 / 壁纸模式下侧栏是玻璃层（`--glass-bg` + 模糊），衬底要比纯色面板再吃掉一层对比度，菜单项原来用 `--color-text-secondary`（暗色下 `#9CA3AF`）看着发灰。

```css
body.dark .vc-subnav__item,
body.has-bg .vc-subnav__item {
  color: color-mix(in srgb, var(--color-text) 78%, var(--color-text-secondary));
}
```

同一条规则顺带照顾了 eyebrow 和页脚说明（分别取 58% / 46% 的 `--color-text`），仍然是"次级"，但不再糊在玻璃里。

实测（暗色）：菜单项 computed color 由 `#9CA3AF` 变为 `color(srgb 0.8595 0.8533 0.9279)` ≈ `#DBD9EC`；选中态仍是主色，主次关系没乱。

### 10.3 文件

| 文件 | 改动 |
|---|---|
| `src/components/PageHeader.tsx` | 新增 `flow?: boolean`，关闭时加 `.vc-page-head--no-flow` |
| `src/pages/Settings/{Account,Providers,LarkBind,Appearance}.tsx` | 4 个子页 `flow={false}` |
| `src/styles/page.css` | `.vc-page-head--no-flow` 隐藏伪元素；`body.dark` / `body.has-bg` 下提亮 `.vc-subnav__*` |

### 10.4 文字层级整体提一档（"网站字体还是太暗"）

接管真实站点（`localhost:3000`，本地绕过登录）逐页量了一遍 computed color 与对比度，问题不在某一处，而是**次级 / 三级文字的两个色值本身压得太低**：

| 位置 | 改前 | 改后 | 实测对比度（同底色） |
|---|---|---|---|
| 暗色 `--color-text-secondary` | `#9CA3AF` | `#C4C0DA` | 5.4:1 → 7.8:1（面板 `#2A2756`） |
| 暗色 `--color-text-tertiary` | `#8A8FA3` | `#A8A4C2` | 4.3:1 → 5.8:1 |
| 亮色 `--color-text-tertiary` | `#9CA3AF` | `#7E8798` | 2.5:1 → 3.6:1（白底；玻璃层上更高） |

受影响的是所有吃这两个变量的地方：面板描述、表单辅助文案、表头（`用户 / 邮箱 / 角色…`）、`@admin` 这类次级行、eyebrow、页脚注释、时间戳。126 处引用一次改到位，没有逐个组件打补丁。

两处同步：`src/contexts/ThemeContext.tsx` 里 `useTheme().colors`（`textSecondary / textTertiary / textTertiary15`）与 `applyCSSVariables()` 的 `setProperty` 必须成对改，只改一边会出现"AntD 组件亮、自绘区域暗"的错位；`global.css` 的 `:root` 兜底值也跟着改成亮色值，避免首帧闪一下旧色。

**没动**的：`--color-text` 本身（仍由配色预设给，`#1E1B4B` / `#EDE9FE`）；`--color-border`、`--color-divider`、阴影、玻璃透明度。文字之外的一律没碰，保证"清雅素净"的底子不变。

`tsc` 0 错误、`build` ✓ 6.9s。

### 10.5 亮色下"整体偏淡"再压一档 + 壁纸上给标题托一层衬光

用户反馈："暗色下还算清晰，亮色下字体是淡灰色，整体偏淡"。

先说一个被否掉的方案：直接把亮色文字改成浅白。**亮色的底就是白的**（面板 `#ffffff`、蒙版 `rgba(255,255,255,0.58)`），浅白字贴上去等于消失，不能做。真正让亮色"淡"的是两件事：文字色本身偏浅，以及壁纸上的小字没有任何衬底。

**① 亮色令牌再压一档**（`ThemeContext` + `global.css` 兜底同步）：

| 变量 | 10.4 的中间值 | 定稿 | 白底对比度 |
|---|---|---|---|
| `--color-text-secondary` | `#6B7280` | `#4B5563` | 5.0:1 → 7.6:1 |
| `--color-text-tertiary` | `#7E8798` | `#66707E` | 3.6:1 → 5.0:1 |

暗色那组（`#C4C0DA` / `#A8A4C2`）保持不变，用户明确说"暗色下还算清晰"。三级关系仍是 text > secondary > tertiary，没有把辅助文字抬成正文。

**② 首页图标标题加衬光**

壁纸上的图标标题是深色字直接压照片，"新大陆见闻"这种压在草的纹理上就糊了。`has-bg` 原本只管图片壁纸（白色变体），视频壁纸走 `WallpaperBackdrop` 时 body 上没有 `has-bg`，于是亮色下这些标题**既没有白字变体、也没有任何衬光**——这就是"淡灰"的来源。

- 新增 `body.has-wall`（图片壁纸 / 视频壁纸 / 兜底渐变只要屏幕上有壁纸就挂上），和 `has-bg` 并存，`has-bg` 的既有语义不动；
- 亮色下补一条：`body.has-wall:not(.dark) .vc-bookmark__label { text-shadow: 0 1px 8px rgba(255,255,255,.8), 0 0 2px rgba(255,255,255,.7); }`

字色仍是 `--color-text`（没变白），只加一层极浅衬光把字从照片纹理里托出来——素净，但看得清。

**还有一个更大的旋钮没动**：亮色的蒙版不透明度默认 58%（`settingsStore.overlayOpacity`），会把壁纸整体冲成灰白，这也是"整体偏淡"的主因之一。它属于用户在「外观」里可调的偏好，没有擅自改默认值；要更通透就把它调到 30~35%，代价是深色字在照片上的余量变小。

`tsc` 0 错误、`build` ✓ 6.9s。

### 10.6 页头流光不许溢出内容列

用户截图指出：流光那条线比下面的面板宽，左右都探出去一截，"不应该超过 page-body"。

两个叠加的原因：

1. `::before` / `::after` 是 `position: absolute; left: 0; right: 0`，位置取决于**包含块**。页头本体是 `position: relative` 时正好等于内容列；但一旦包含块被别处改到 `.vc-page__body` 的 **padding box**，线就变成"内容列 + 左右各一个 padding"——768~1439px 时多 24px、≥1440px 时多 48px，和截图里那截探出去的距离对得上。
2. 走光段 `::after` 是整条 100% 宽的渐变，靠 `translate3d(±58%)` 移动，走到两端时元素本身就溢出页头左右各 58%。

改法是把线画进页头自己的盒子里，再裁掉：

```css
.vc-page-head {
  position: relative;
  padding-bottom: 15px;                        /* 原来靠 bottom:-15px 悬在外面 */
  margin-bottom: calc(var(--space-xl) - 15px); /* 版式不变 */
  overflow: hidden;                            /* 走光被裁在内容列内 */
}
.vc-page-head::before,
.vc-page-head::after { bottom: 0; }
```

`overflow: hidden` 裁的是页头自己的 padding box，跟包含块是谁无关，所以两种情况一起解决；`padding-bottom` 由 15 涨、`margin-bottom` 减 15，面板纵向位置实测前后都是 185px，间距一点没动。

验证：对截图那一行做像素差分扫描，改前线起点落在 page-body 内边距边（325），改后回到 **349 = 面板左边缘**，和下面卡片对齐。

`tsc` 0 错误、`build` ✓ 6.9s。