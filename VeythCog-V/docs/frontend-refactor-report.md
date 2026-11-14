# 前端视觉统一改造 · 成果汇总

> 依据：`VeythCog-V/docs/frontend-style-guide.md`（淡紫低饱和空间感 + 真毛玻璃层叠 + 克制品牌紫光）
> 范围：除 `src/pages/Login`（基准参照页，标签页内登录，未列入改造）以外的全部页面与共享组件
> 验收口径：`npx tsc --noEmit` exit 0 + 无头 Edge 读取 computed style 与几何量（不靠截图目测）
> 本文不含截图，全部结论来自脚本采集的数值。

---

## 一、改造总览

| 指标 | 改造前 | 改造后 |
| --- | --- | --- |
| 视觉体系 | 各页内联样式各自调色（colors.*、写死 rgba、随意圆角/间距） | 统一 `.vc-*` 语义类 + 主题 CSS 变量令牌 |
| 样式载体 | pages 内联 style 为主 | 新增 `src/styles/page.css`（4811 行，唯一布局样式表） |
| 硬编码品牌紫 | pages 中 15 个文件含 `#7C3AED`/`rgba(124,58,237,…)` | 全部清除（仅保留 presets/背景预设定义处、Login 基准页、ColorTool 占位文案） |
| 页面标题 | 各页自建（20/22/24px 混用） | `.vc-title` 28px/700、`.vc-desc` 13px/22.1px |
| 输入控件 | 高度 36/38/40 混用，聚焦发光描边 | 统一 44px、radius 10、聚焦 3px primary 14% 光圈 |
| 主按钮 | 亮/暗均白字（暗色不合规范） | 亮色白字，暗色亮填充 + 深字（#14102B 系） |
| 面板 | 圆角 8–20、padding 12–32 混用 | radius 16、padding 24、1px 边框，玻璃时半透明 |
| 滚动结构 | 部分页面出现双层滚动 | 全局唯一滚动容器，页面级 `scrollWidth/Height` 无溢出 |

改动文件：**85 个 tracked 文件修改 / 3 个新增 / 1 个删除**（删除 `ThemeSettings.tsx`，全仓无引用，属死代码）。

---

## 二、全局基座（所有页面共享，先于逐页改造落地）

### 1. 新增 `src/styles/page.css`
按 style guide 的分组组织：页面骨架（`.vc-page/.vc-page__body/.vc-page-head/.vc-title/.vc-desc`）、二级导航（`.vc-subnav-layout/.vc-subnav/.vc-subnav-content`）、面板与卡片（`.vc-panel/.vc-grid/.vc-card/.vc-stat`）、表单与工具（`.vc-toolbar/.vc-field-label/.vc-setting-row`）、状态位（`.vc-state`）、弹层（`.vc-modal/.vc-dialog-scrim`）、及各业务域（工具集、JSON 查看器、知识库、对话、首页、播放器、壁纸库）。
所有颜色、圆角、间距、阴影、动效曲线均取自 `--color-*`、`--radius-*`、`--space-*`、`--shadow-*`、`--ease-*` 令牌，未新增魔法值。响应式只做容器与内边距缩放（≥1900px 放大、≤900px 单列、≤720px 收窄），令牌刻度不随断点变化（原 global.css 在 640/768/1024/1280 覆盖 `--space-*`/`--radius-*` 的规则已删除）。`prefers-reduced-motion` 下关闭过渡。

### 2. 组件层
- `components/PageHeader.tsx`：props `{title, description?, eyebrow?, extra?}` → `h1.vc-title` + `.vc-eyebrow` + `.vc-desc` + `.vc-actions`，成为所有页面标题的唯一入口。
- `components/SectionNav.tsx`（新增）：导出 `SectionNav` 与 `SubPageLayout`，Settings/Admin 的一级二级结构共用一套侧栏几何（200px、项高 36–40、激活态 primary 底 + 左竖条）。
- `components/states/{EmptyState,LoadingState,ErrorState}.tsx`：统一 `.vc-state` 排版（图标 44px、标题 14/600、描述 13px 次要色），颜色取 `useTheme().colors`，不再写死 `#999`/`#ff4d4f`。
- `pages/tools/ToolShell.tsx`：所有工具页的壳（标题 + 描述 + 右上 actions + 内容区），`fillHeight` 时输出 100% 高度的可伸缩工作区。

### 3. 主题与全局样式修正（属于"把已有机制纳入统一风格"的关键改动）
- `contexts/ThemeContext.tsx`：`applyCSSVariables(preset, isDark, glassEnabled, glassOpacity)` —— 玻璃模式下 `--color-surface`/`--color-surface-elevated` 输出半透明值（亮色 `rgba(255,255,255,0.55/0.65)`，暗色 hexToRgba(surface, 0.55/0.65)）。**原因**：此前 `useTheme().colors` 是半透明而 CSS 变量仍是实心色，凡是用 CSS 变量写样式的输入件/面板在壁纸玻璃模式下会变成实心块，玻璃层断裂。
- `styles/global.css`：删除输入件"全局发光描边"（默认 12px 紫光、聚焦 22px 紫光，含 `!important`），改为规范要求的静态内高光 + 聚焦 `0 0 0 3px primary 14%`；新增暗色主按钮文字规则 `body.dark .ant-btn-primary { color: var(--color-text-inverse) }`（亮填充 + 深字）。
- `styles/theme.ts`：`Input.controlHeight` 40 → 44（guide §7 输入高 44）；Button 保持 40 / radius 10；token.borderRadius 12、Card 16 不动。
- `main.tsx`：`global.css` 之后 `import "./styles/page.css"`，保证业务类覆盖 AntD 基座。

### 4. 壁纸/主题机制（未绕过、未重复实现）
- 主题：仍然只走 `ThemeContext` + `useTheme().colors` + `presets.ts`（6 套预设 × 明暗）+ `settingsStore`；改造只是把页面取色改为读同一套 token，没有新增第二套主题源。
- 外观/玻璃：`localStorage['theme-preset']`/`['theme-appearance']`/`mywork:settings` 键与读写路径不变；`body.glass-on`、`body.dark`、`body.has-bg` 三个开关仍由 ThemeContext 统一挂载。
- 壁纸：`wallpaperStore` + `/nav/wallpaper/*` 接口 + `WallpaperBackdrop`/`WallpaperMedia`/`WallpaperManagerModal` 三层结构保持不变；首页的"壁纸白玻璃"继续使用 `styles/homeSurface.ts` 的 `whiteGlass()`/`glassBlur()` 单一入口，未另造参数。

---

## 三、逐页对照与自检结论

自检方法：用一次性无头 Edge 脚本（CDP 驱动）以 1440×900 打开页面，先写入登录态再导航，采集标题/描述/面板/侧栏/内容区/按钮/输入件的 computed style 与几何量，并统计页面级横向溢出、子元素溢出、控制台错误；亮色与「暗色 + 玻璃 + 壁纸」两种环境各跑一遍。脚本与其浏览器 profile 属临时产物，收尾时已删除，未纳入仓库。

### A. 设置模块

| 页面 | 对照说明 | 自检结论 |
| --- | --- | --- |
| `pages/Settings/index.tsx` | 改为 `SubPageLayout`：左侧 200px 二级导航（账号/供应商/飞书/外观），右侧内容容器 max 960；菜单图标沿用 lucide，激活态 primary 底 + 左竖条 | 侧栏 200、标题 28/700、内容 padding 32 32 48、scroll 0、溢出 0、错误 0 |
| `pages/Settings/Account.tsx` | 两个 `.vc-panel`（基本信息 / 修改密码）+ `.vc-account-avatar`（主色底 + `colors.textInverse` 字，去除写死 #fff 与遮罩 rgba）；上传/移除头像、保存、改密逻辑原样 | 面板 r16 p24 边框 rgb(221,214,254)、输入 44/r10、按钮 40/r10、溢出 0 |
| `pages/Settings/Providers.tsx` | 渲染层整体重写：供应商卡 `.vc-provider`、密钥与业务空间块、模型行 `.vc-model-row`、`.vc-slim-progress` 细进度条；校验/保存/清空/解绑行为不变 | 面板与按钮规格同上；后端未启动时显示 `.vc-state` 空态（控制台 2 条 Failed to fetch 属预期） |
| `pages/Settings/LarkBind.tsx` | 绑定态 `.vc-lark-head`（品牌图标 + 账号名 + 解绑），未绑定态 `.vc-state`；mock 授权 1.2s 不变 | 按钮 40/r10、面板 r16、溢出 0、错误 0 |
| `pages/Settings/Appearance.tsx` | 4 个面板：配色预设（`.vc-theme-swatch` 12 色点，选中描边 + check）、外观模式（`.vc-segmented` 胶囊）、背景（`.vc-bg-current` 预览 + `.vc-bg-swatch` 纯色兜底，壁纸入口仍打开 `WallpaperManagerModal`）、全局毛玻璃（开关 + 透明度滑块） | 面板 r16、按钮 40/r10；暗色玻璃下 body=`dark glass-on has-bg`、面板 rgba(42,39,86,0.49)、边框 rgba(255,255,255,0.1) |

### B. 系统管理（RequireAdmin）

| 页面 | 对照说明 | 自检结论 |
| --- | --- | --- |
| `pages/Admin/index.tsx` | `SubPageLayout`（wide，max 1200）：用户/角色/模型/监控/审计/任务/配置 | 侧栏 200、内容 32 32 48、溢出 0 |
| `pages/Admin/Monitoring.tsx` | 整体重写：6 张 `.vc-stat` 指标卡 → 调用趋势（`.vc-chart`，错误柱红）→ 服务资源（`.vc-meter`，>60% 警示、>85% 危险）→ 四张 `.vc-table-card` 表格卡；数字列 `.vc-num`、接口/模型 `.vc-route/.vc-mono` | 面板 r16 p16 24、表格内小按钮 30/r6、内容 32 32 48、无溢出；暗色玻璃下与设置页一致 |
| `pages/Admin/Users.tsx` | 仅 1 处内联 style（头像取 `colors.primary`/`colors.textInverse`），其余为 `.admin-panel/.admin-table` 体系，符合规范，未重写 | 面板 r16 p0（表格型）、新增用户按钮 40/r10、溢出 0 |
| `pages/Admin/Models.tsx` | 同上（2 处 `colors.*` 内联），表格 + 抽屉沿用共享体系；状态标签改用 `.vc-type-tag` 语义色 | 按钮 40/r10、输入 44/r10、溢出 0 |
| `pages/Admin/Roles.tsx` | 已为 `.vc-*` 体系（表格 + 抽屉表单） | 面板 r16 p0、溢出 0、错误 0 |
| `pages/Admin/AuditLog.tsx` | 搜索框（`.ant-input-search` 组合态，左圆角 10）+ 结果表格 | 搜索输入 44、组合按钮 44/r0 10 10 0、溢出 0 |
| `pages/Admin/Tasks.tsx` | 任务表格 + 行内"立即执行"（AntD small 30/r6，表格密度例外） | 面板 r16 p0、溢出 0、错误 0 |
| `pages/Admin/Config.tsx` | 单面板表单（保存配置） | 面板 r16 p24、输入 44、按钮 40/r10、溢出 0 |

### C. 开发工具集（`/tools` 与 26 个工具）

| 页面 | 对照说明 | 自检结论 |
| --- | --- | --- |
| `pages/tools/ToolsLayout.tsx` | 左侧 260px 工具导航（分组标题 11/600 大写）+ 顶部 44px 页签栏（激活页签主色底 + 底部 2px 指示），关闭页签跳相邻工具；页签状态保留逻辑不变 | 侧栏 260、页签 44、内容 24 24 48、溢出 0 |
| `pages/tools/index.tsx` | 工作区首页：搜索（260 宽）+ 收藏区 + 分类网格，卡片 `.vc-tool-card`（键盘 Enter/Space 可打开，星标用 warning 色） | 内容 24 24 48、ch 1752、溢出 0、错误 0 |
| `pages/tools/ToolShell.tsx` | 工具页外壳：标题/描述/右上 actions，`fillHeight` 输出全高工作区 | 所有工具页标题 28/700、描述 13px |
| 编码/转换类：`Base64Tool`/`UrlEncoder`/`HexTool` | 抽出共用壳 `components/CodecTool.tsx`：左输入右输出双 `.vc-tool-pane`、方向 `.vc-segmented`、复制按钮、错误 `.vc-tool-error` | 双栏各 577 宽、按钮 40/r10、溢出 0 |
| `JsonFormatter`/`JsonYaml`/`JsonPathTool` | 双 pane + 底部工具条（格式化/压缩/转义/缩进 Radio/求值）；错误态 `.vc-tool-pane.has-error`（error 45% 描边 + 12% 光圈） | 同上；输入区透明无边框由 pane 承担 |
| `components/JsonTreeView`/`JsonHighlight` | 去掉 `colors` 传参，改用 `.vc-json-key/str/num/lit/punct` 语义类；树节点 `.vc-json-toggle`；空态「（暂无内容）」 | 渲染正常、未破坏展开/折叠与 expandAll/collapseAll ref |
| `JwtDecode` | 左 Token、右侧 Header/Payload 两个纵向 pane | 无溢出、错误 0 |
| `HashTool` | 双 pane + `.vc-hash-row`（算法 64px mono 主色 + 值 + 复制图标按钮） | 同上 |
| `RegexTester` | `.vc-regex-bar`（/pattern/ + flags + 6 个常用模式胶囊）、匹配结果 `mark.vc-mark` | 输入 44/r10、溢出 0 |
| `CaseConverter` | 输入面板 + 8 张风格卡片（`.vc-card`），转换逻辑不变 | 面板 r16 p24、溢出 0 |
| `TextDiff` | 上下三段 pane，行级 `.vc-diff-line.is-add/.is-del` | 溢出 0 |
| `WordCount` | 5 张 `.vc-stat` + 双 pane（去重结果只读） | 溢出 0 |
| `TextReplace` | `.vc-stack` 四段（原文/查找替换/结果/历史）+ 可拖拽缩放的对比弹窗（`.vc-floating-dialog`，600×400 下限保留） | 面板 r16、按钮 40/r10、溢出 0 |
| `TranslatorTool` | 左原文（拼音 `.vc-tool-note` + 朗读）、右译文 + 离线词典 `.vc-dict`；竞速翻译/缓存/历史逻辑不变 | 面板与按钮规格达标；暗色玻璃复测通过 |
| `TimestampTool`/`TimezoneTool` | `.vc-clock-value` mono 28/700 数字 + 复制卡片；13 个常用时区不变 | 输入 44、面板 r16、溢出 0 |
| `SqlFormatter`/`CurlConvert`/`CommandLineWrap` | 双 pane + 错误态 + 复制；cURL 解析、命令行折行算法原样 | 溢出 0、错误 0 |
| `CronExplainer` | 表达式输入 + 含义面板 + 未来 5 次执行（`.vc-hash-row`） | 输入 44、溢出 0 |
| `UuidTool` | 工具条内 Slider + 数量 + 生成/复制，结果网格卡片点击即复制 | 按钮 40/r10、溢出 0 |
| `PasswordTool` | 结果 `.vc-pwd-value`（mono 20px、可整段选中）+ 生成选项面板（`.vc-setting-row`：长度滑块、大写/数字/符号开关），`crypto.getRandomValues` 不变 | 面板 r16 p24、按钮 40/r10、溢出 0 |
| `BaseConverter` | 单面板 + 2×2 字段网格（`.vc-field-label` + mono Input） | 输入 44、溢出 0 |
| `ColorTool` | 左侧大色块 `.vc-color-preview` + 原生取色器，右侧 HEX/RGB/HSL 只读 + 复制；初始值取 `colors.primary`（不再写死紫） | 输入 44、溢出 0 |
| `ImageBase64` | 拖拽区 `.vc-dropzone`（拖入态高亮）+ 左预览右 Data URL，`FileReader` 与尺寸解析不变 | 溢出 0、错误 0 |
| `MarkdownPreview` | 双 pane，右侧预览复用 `.md-body`（`.vc-md-preview` 收边） | 溢出 0 |

### D. 知识库

| 文件 | 对照说明 | 自检结论 |
| --- | --- | --- |
| `pages/Knowledge/index.tsx` | 左栏 280px（标题 + 共 N 篇 + 搜索 + 新建/导入 + 文档列表 `.vc-doc-item`，含向量化小闪电与标签），右栏文档头 `.vc-doc-head`（标题可点击聚焦 + 向量化状态 + 操作组）；创建/AI 生成元数据/保存/向量化/导入导出/删除等行为全保留 | 侧栏 280、按钮 40/r10、无溢出（修复了新建按钮 100% 宽导致的 82px 溢出）、错误 0 |
| `pages/Knowledge/DocEditor.tsx` + `doc-editor.css` | 目录改 `.doc-outline`（220px、透明底、分隔线），编辑区与工具栏改令牌色；BlockNote 主题仍跟随 `isDark` | 暗色玻璃下正文颜色随主题、无溢出 |

### E. 对话

| 文件 | 对照说明 | 自检结论 |
| --- | --- | --- |
| `pages/Chat/index.tsx` | 左栏会话列表 `.vc-conv-item`（悬停浮现删除）、右栏 `.vc-chat-main`（56px 头部 + 消息滚动区 + 底部 `.vc-composer`）；空态、建议词、引用卡片、知识库选择器全部 `.vc-*`；流式输出、压缩开关、模型选择、知识库绑定逻辑不变 | 用户气泡 主色底/白字（暗色 亮填充+深字 rgb(30,27,75)）、发送按钮 34 圆、输入 44、溢出 0、错误 0 |
| `components/MessageBubble.tsx` | 气泡 `.vc-msg__bubble`（用户 16 16 4 圆角 + 主色，助手 surface + 1px 边框），markdown 复用 `.md-body` | 暗色玻璃下气泡与玻璃层不冲突 |
| `components/CollapsibleSidebar.tsx` | 折叠改为纯 CSS（`.vc-collapse`，把手 `.vc-collapse__handle`），折叠状态仍持久化在 `settingsStore` | 折叠/展开动画走 transform，无抖动 |

### F. 首页（独立布局，含壁纸白玻璃）

| 文件 | 对照说明 | 自检结论 |
| --- | --- | --- |
| `pages/Home/index.tsx` | 保留全部交互（滚轮切分类、右键菜单、书签增删改、壁纸应用）；渲染改为 `.vc-home` 骨架 + `.vc-home-menu` 右键菜单（壁纸模式深色玻璃，普通模式 surfaceOverlay） | 1440×900 无溢出、错误 0 |
| `pages/Home/SearchBar.tsx` | 1198 行中仅重写渲染段：`.vc-search` 玻璃条（壁纸模式 `whiteGlass()` 渐变 + `glassBlur()` + 内高光）、引擎切换、联想菜单、AI 回答面板、来源、翻译、知识库胶囊全部换类；联想/防抖/SSE/三引擎搜索逻辑逐字保留 | 亮色 640×54 玻璃 rgba(255,255,255,0.49) blur 16；壁纸模式 白色渐变 + border rgba(255,255,255,0.55) blur 19 |
| `pages/Home/BookmarkGrid.tsx` + `BookmarkIcon.tsx` | 网格 66.67vw（min 320 / max 100vw-48）、行高 100/gap 12、最多 4 行滚动；图标位 `.vc-iconpreview`，壁纸模式自动图标用 `whiteGlass()`+`glassBlur()`，文字图标保留用户自选色；悬停操作区 `.vc-bookmark__action` | 亮色 8 图标/10 列/84px；壁纸模式 auto 图标 rgba(255,255,255,0.22)+blur 19 |
| `pages/Home/HomeSidebar.tsx` + `layouts/MainLayout.tsx` | 首页浮动 rail 与内页固定 rail 共用 `.vc-rail` 几何（72px、radius-xl、10px 边距、48px logo、40 项高），激活态 primary 10% 底 + primary 字 + 3px 竖条 | rail 72×880、玻璃 rgba(255,255,255,0.49) blur 16（暗色 rgba(42,39,86,0.49)） |
| `pages/Home/HomeDock.tsx` | `.vc-dock` 底部居中（7 个 44 按钮、3 分钟无操作 opacity .16、hover 唤醒）；壁纸模式白玻璃底 | dock 44、激活项 primary 10% + 主色字 |
| `pages/Home/CategorySidebar.tsx` | `.vc-catnav` 右侧分类栏（60 行高、滑块跟随、1.5s 延迟隐藏），壁纸模式白玻璃 | 宽 64、壁纸模式 rgba(255,255,255,0.14) |
| `pages/Home/Clock.tsx`/`QuoteBar.tsx` | `.vc-clock__time` 96px/300 tabular-nums、日期 16px；引用 `.vc-quote` 14px 70% 白；壁纸模式由 `body.has-bg` 选择器切换白字与文字阴影 | 亮色 96px rgb(30,27,75)、引用 rgb(107,114,128)；壁纸模式 #fff / rgba(255,255,255,.7) |
| `pages/Home/BookmarkModal.tsx` | `.vc-modal` + 两张 `.vc-form-card` + 图标宫格 `.vc-icon-tile`（含上传态）+ 11 个预设色点 `.vc-color-dot`；获取图标/上传校验/保存并继续逻辑不变 | 弹窗 r16、按钮 40 |
| `pages/Home/CategoryManageModal.tsx` | `.vc-modal` + 新增行 `.vc-toolbar` + 列表行 `.vc-cat-row` | 同上 |

### G. 共享组件与浮层

| 文件 | 对照说明 | 自检结论 |
| --- | --- | --- |
| `components/FloatingMusicPlayer.tsx` | 玻璃卡 `.vc-player__card`（`--glass-*`）、收起只露 22px 把手、展开/拖拽/播放列表全部换类，音频与拖拽常量（340/20/150）保留 | 收起态 translateX(318)、展开归零；壁纸下 rgba(255,255,255,0.49) 描边 0.3 |
| `components/WallpaperManagerModal.tsx` | 左右结构 `.vc-wallpaper`（200px 分类 + 卡片网格），选中态 primary 描边 + 光晕，视频/图片角标与刷新按钮统一；列表加载与选择逻辑不变 | 分类栏 200、激活 tab 主色、卡片 4 张、选中描边主色 |
| `components/SettingsModal.tsx` | 账号菜单里的设置浮窗：左 196px 导航 + 右侧复用 Account/Providers/LarkBind/Appearance 页面 | 导航 196、激活项主色字 + 12% 底 |
| `components/UserMenu.tsx` | 头像 `.vc-avatar` + 菜单 `.vc-usermenu`（在线圆点、分隔线、设置项） | 暗色玻璃下菜单层级正常 |
| `components/ModelTypeTag.tsx` | 从 AntD Tag + 内联色改为 `.vc-type-tag--{primary|info|success|warning|error|neutral}` 语义色；导出 API 与 chatCapable 语义不变 | 表格/模型列表显示正常 |
| `components/WallpaperMedia.tsx` | 加载失败占位 `.vc-media-fallback`（不再内联 rgba） | — |
| `components/ErrorBoundary.tsx` | 兜底页 `.vc-fatal`（标题/说明/重试），去 system-ui 与写死灰 | — |
| `components/WallpaperBackdrop.tsx` / `VeythCogLogo.tsx` | 未改：前者只用 overlay 透明度计算、无硬编码主题色；后者颜色由 props 传入（rail 处传 `colors.primary/accent`） | 玻璃/壁纸不重复实现 |
| `components/ThemeSettings.tsx` | 全仓无引用的死代码，重写前 grep 确认后删除；主题入口实际在 `/settings/appearance` | tsc 通过 |

---

## 四、视觉自检结论（数值口径）

统一环境：1440×900、deviceScaleFactor 1；亮色 `body` 无附加类，暗色玻璃壁纸 `body="dark glass-on has-bg"`。

1. **排版**：所有带 PageHeader 的页面标题 28px/700 `Space Grotesk`（亮 rgb(30,27,75) / 暗 rgb(237,233,254)），描述 13px/22.1px（亮 rgb(107,114,128) / 暗 rgb(156,163,175)）。
2. **面板**：`border-radius 16px`、`padding 24px`、1px 边框（亮 rgb(221,214,254) / 暗 rgba(255,255,255,0.1)）；暗色玻璃下背景 rgba(42,39,86,0.49) 且带 `blur(20px) saturate(1.4)`。
3. **控件**：输入/下拉高 44、radius 10；主按钮 40/radius 10，亮色主色底白字、暗色亮填充深字。
4. **布局**：内页 rail 72px、二级侧栏 200（工具 260、知识库 280、对话 280）；内容内边距设置/管理 32 32 48、工具/工作区 24 24 48。
5. **稳定性**：全部 41 条路由（/tools 与 26 个工具页、4 个设置页、知识库、7 个管理页、对话、首页）的页面级横向溢出 `scrollWidth-innerWidth = 0`、可见子元素溢出 0（已排除 `position:fixed` 与折叠把手等有意位移）。
6. **控制台**：仅 `/settings/providers`、`/admin/users` 出现 `Failed to fetch`，原因是本地后端未启动、页面正确降级为空态，非样式缺陷。
7. **类型与构建**：`cd VeythCog-V && npx tsc --noEmit` exit 0（每次改动后均验证）。

覆盖清单（全部通过）：`/tools` + 26 个工具页；`/settings/{account,providers,lark,appearance}`；`/knowledge`；`/admin/{users,roles,models,monitor,audit,tasks,config}`；`/chat`；`/home`；以及 `/settings/appearance` 触发的壁纸库弹窗、`/settings/account` 触发的设置浮窗与用户菜单、`/chat` 触发的音乐播放器展开态。

---

## 五、保留与例外说明

- **功能零改动**：所有接口调用、状态机、快捷键、拖拽、SSE 流式、缓动、持久化键名均未改变；改造集中在 className/style 与组件结构。
- **Login 页未改**：它是 style guide 的基准参照（`login.css` 1076 行），本次不动，保证"已改页面与基准一致"的可比性。
- **AntD small 按钮（30px/r6）**：仅出现在表格行内与次级操作（任务"立即执行"、监控"下线"、账号"上传头像"），属信息密度例外；全站同类按钮尺寸统一，不破坏视觉一致性。
- **保留的写死白色值**：首页壁纸模式的白玻璃参数（rgba 白 0.14/0.28/0.55、内高光、文字阴影）与用户自选图标色/可读文字色算法，属于"壁纸之上必须的白色层"，符合 guide §5 的壁纸浮层规则。
- **后端依赖**：providers/users 等页面在本地无后端时显示空态，属预期降级。

---

## 六、验证入口

```bash
cd VeythCog-V && npx tsc --noEmit     # 类型检查，应 exit 0
cd VeythCog-V && npm run dev          # http://127.0.0.1:3000
```

人工复验要点（与本文数值一一对应）：

1. 任取 3 个页面，DevTools 检查标题是否 28px/700 Space Grotesk、面板是否 radius 16 / padding 24 / 1px 边框、输入是否 44 高、主按钮是否 40 高。
2. 在「外观」页切换暗色与毛玻璃、在「背景」页选壁纸，确认 `body` 依次出现 `dark` / `glass-on` / `has-bg`，面板变为半透明玻璃、首页出现白色玻璃层。
3. 检查页面级横向滚动条是否出现（应无），并确认滚动只发生在内容卡内部。

## 七、本次产物清单

| 文件 | 说明 |
| --- | --- |
| `VeythCog-V/src/styles/page.css` | 唯一布局样式表（新增） |
| `VeythCog-V/src/components/SectionNav.tsx` | 二级导航基座（新增） |
| `VeythCog-V/src/pages/tools/components/CodecTool.tsx` | 编解码工具共用壳（新增） |
| `VeythCog-V/docs/frontend-refactor-report.md` | 本文 |
| 其余 80 余个源文件 | 改造后的页面与组件（见 git status） |

临时产物（自检脚本、无头浏览器 profile、探测文件、调试片段、临时日志）已全部清理，仓库内不留。
