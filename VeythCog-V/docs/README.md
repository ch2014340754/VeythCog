# 个人工作网站 - 前端

## 项目定位

这是一个正在演进中的**个****人协作工作平台**前端 Demo，规划四大业务模块 + 管理员后台：

1. **多模型对话** — 对接大模型 API（OpenAI 兼容协议），支持流式输出
2. **知识库 + 飞书笔记** — 文档管理、笔记、飞书集成
3. **开发工具集** — 24 个常用开发小工具（已完成）
4. **数据库可视化查询** — SQL 编辑器 + 结果表格（待开发）
5. **系统管理** — 仅管理员可见，用户/模型目录/监控/审计/定时任务/系统配置

当前阶段：工具集已完成，P0 基础设施（HTTP/SSE/全局 store/持久化/错误边界）已就位；账号体系、模型供应商管理、飞书绑定、全局毛玻璃、浮动音乐播放器均已落地；对话已接真后端 LLM 路由，知识库仍走 mock。管理员后台前端已完成，全部 mock。

## 技术栈

| 技术                           | 用途                                      |
| ------------------------------ | ----------------------------------------- |
| React 18 + TypeScript + Vite 5 | 基础框架                                  |
| Ant Design 5                   | UI 组件库                                 |
| React Router 6                 | 路由                                      |
| Zustand + persist              | 全局状态管理（自动持久化到 localStorage） |
| @iconify/react + Lucide        | 图标                                      |
| react-markdown                 | AI 回复 Markdown 渲染                     |
| js-yaml                        | JSON ↔ YAML 互转                         |
| sql-formatter                  | SQL 格式化                                |
| diff                           | 文本 diff                                 |
| cron-parser                    | Cron 表达式解析                           |
| crypto-js                      | MD5 哈希（SHA 走 Web Crypto）             |
| @fontsource                    | 本地字体，无外部 CDN                      |

## 快速启动

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # 产物在 dist/
npm run preview  # 预览构建结果
```

## 项目结构

```
src/
├── main.tsx                  # 入口
├── App.tsx                   # 根组件（ThemeProvider + ErrorBoundary + 路由 + RequireAuth 守卫）
│
├── config/
│   └── index.ts              # ★ 环境变量统一读取层（业务代码不直接碰 import.meta.env）
│
├── api/
│   ├── client.ts             # ★ HTTP 封装（fetch：baseURL / 自动 token / 401 / 超时 / 统一错误）
│   ├── sse.ts                # ★ SSE 流式封装（fetch + ReadableStream，支持 abort）
│   ├── auth.ts               # 登录/登出/获取当前用户（已接真后端 JWT）
│   ├── chat.ts               # 对话 API（已接真后端）
│   ├── knowledge.ts          # 知识库 API（当前 mock）
│   ├── llm.ts                # 模型目录/绑定 API（已接真后端）
│   ├── admin.ts              # ★ 系统管理 API（当前全 mock，后端对接时替换）
│   └── index.ts
│
├── stores/                   # ★ Zustand 全局状态（persist 自动持久化）
│   ├── authStore.ts          #   登录 token、当前用户、飞书绑定状态
│   ├── settingsStore.ts      #   模型供应商、当前模型、流式开关、全局毛玻璃开关
│   ├── chatStore.ts          #   会话列表、当前会话、流式增量
│   ├── knowledgeStore.ts     #   知识库、笔记
│   ├── dbStore.ts            #   数据库连接
│   ├── toolTabsStore.ts      #   工具标签页
│   └── index.ts
│
├── contexts/
│   └── ThemeContext.tsx      # 主题状态（6 预设 × 亮暗 + 全局毛玻璃开关）
│
├── components/
│   ├── ErrorBoundary.tsx     # 崩溃兜底
│   ├── MessageBubble.tsx     # 消息气泡（Markdown / hover 操作）
│   ├── ThemeSettings.tsx      # （旧）主题设置面板，已被 SettingsModal 取代
│   ├── UserMenu.tsx          # ★ 左下角头像下拉（打开 SettingsModal）
│   ├── SettingsModal.tsx     # ★ 设置弹窗（账号/模型/飞书/外观 四个 tab）
│   ├── FloatingMusicPlayer.tsx # ★ 全局浮动音乐播放器（毛玻璃、可拖动、可收起）
│   ├── CollapsibleSidebar.tsx  # ★ 可折叠侧栏外壳（对话/知识库列表收起展开，持久化）
│   ├── VeythCogLogo.tsx      # 品牌 Logo
│   ├── PageHeader.tsx        # 通用页头
│   └── states/               # 通用空/载/错状态
│       ├── EmptyState.tsx
│       ├── LoadingState.tsx
│       └── ErrorState.tsx
│
├── layouts/
│   └── MainLayout.tsx        # 主布局（左侧图标导航 + 内容区 + 浮动播放器）
│
├── pages/
│   ├── Login/                # 登录页（mock：任意账号/一键进入）
│   ├── Chat/                 # 对话页
│   ├── Knowledge/            # 知识库页
│   ├── Settings/             # 设置页（路由版 /settings，菜单入口走 SettingsModal）
│   │   ├── index.tsx         #   左侧菜单壳
│   │   ├── Account.tsx       #   账号信息（含修改密码折叠展开）
│   │   ├── Providers.tsx     #   大模型供应商（baseUrl + apiKey + 模型列表）
│   │   ├── LarkBind.tsx      #   飞书绑定
│   │   └── Appearance.tsx    #   配色预设 + 亮暗 + 全局毛玻璃开关 + 壁纸
│   ├── Admin/                # ★ 系统管理（仅管理员，/admin/*）
│   │   ├── index.tsx         #   左侧菜单壳（用户/模型/监控/审计/任务/配置）
│   │   ├── Users.tsx         #   用户管理（CRUD/禁用/重置密码）
│   │   ├── Models.tsx        #   模型目录（供应商/模型可见性、默认模型）
│   │   ├── Monitoring.tsx    #   系统监控（调用量趋势/在线会话/错误日志）
│   │   ├── AuditLog.tsx       #   审计日志
│   │   ├── Tasks.tsx          #   定时任务（清理/统计，启停/立即执行）
│   │   └── Config.tsx         #   系统配置（注册开关/公告/默认偏好）
│   └── tools/                # ★ 工具集
│       ├── ToolsLayout.tsx   #   二级侧栏 + 多标签页（切换不丢状态）
│       ├── index.tsx         #   工具首页（卡片网格）
│       ├── registry.tsx      #   工具注册表（加工具只需加一项）
│       ├── ToolShell.tsx     #   工具通用壳
│       └── tools/            #   24 个工具组件（React.lazy 独立分包）
│
├── styles/
│   ├── presets.ts            # 6 套配色预设
│   ├── theme.ts              # AntD 主题映射
│   └── global.css            # 全局样式 + Markdown 渲染 + 毛玻璃覆盖
│
├── mock/                     # Mock 数据（后端对接后可删）
│   ├── chat.ts
│   ├── knowledge.ts
│   └── music.ts              # 音乐播放器 mock 歌单（SoundHelix 示例音频）
│
├── types/
│   ├── index.ts              # 业务类型（User / LarkBinding / LlmProvider / ...）
│   └── env.d.ts              # Vite 环境变量类型
│
└── utils/
    ├── storage.ts            # ★ localStorage 封装（命名空间 + TTL）
    └── formatTime.ts
```

## 核心架构

### 三层依赖方向

```
页面组件 → stores/（业务状态）→ api/（数据请求）→ mock/（当前）/ 真实后端（未来）
                              ↘ config/（环境变量）
                              ↘ utils/storage.ts（本地持久化）
```

### HTTP 与 SSE

- **普通请求**：`import { http } from '@/api/client'`，自动带 token、处理 401（自动跳 /login）、统一错误
- **流式对话**：`import { streamChat } from '@/api/sse'`，回调式 API，返回 `AbortController` 可中断

### 全局状态（Zustand）

6 个 slice，全部配 `persist` 中间件，刷新自动恢复：

| Store                 | 管什么                                                                |
| --------------------- | --------------------------------------------------------------------- |
| `useAuthStore`      | 登录 token、当前用户、飞书绑定状态                                    |
| `useSettingsStore`  | 模型供应商（baseUrl+apiKey+模型）、当前模型、流式开关、全局毛玻璃开关 |
| `useChatStore`      | 会话列表、当前会话、流式增量                                          |
| `useKnowledgeStore` | 知识库、笔记                                                          |
| `useDbStore`        | 数据库连接                                                            |
| `useToolTabsStore`  | 工具标签页                                                            |

### 路由与登录守卫

- `/login` 独立路由（不走主布局）
- 其余路由包在 `RequireAuth` 里，未登录自动跳 `/login` 并记录来源，登录后回跳
- `/admin/*` 额外包在 `RequireAdmin` 里，`user.role !== 'admin'` 重定向回 `/chat`
- 左下角头像下拉：账号设置 / 外观主题 / 飞书绑定 → 打开 `SettingsModal`（当前页弹窗，不跳路由）
- 左侧导航栏底部：admin 用户看到盾牌图标入口，普通用户不渲染

### 主题系统

11 套预设（紫晶/翡翠/靛蓝/玫瑰/石墨/潮汐/新芽/钴蓝/青柠/落日/薄雾）× 亮暗两模式，双轨颜色机制：

- `useTheme().colors` 直接值 → inline style，React 渲染同步
- CSS 变量 → global.css / AntD CSS-in-JS

**全局毛玻璃开关**（`settingsStore.glassEnabled`）：

- 打开后 `<body>` 加 `glass-on` class
- 浮层/卡片：`backdrop-filter: blur(20px) saturate(180%)` + 半透明底色 + 顶部内高光 + 外阴影
- 输入框/按钮：边缘毛玻璃（轻 blur，避免文字发糊）
- 导航/列表选中项：轻 blur 高亮

### 模型供应商

`settingsStore.providers` 是"供应商 → 模型"两层结构：

- 每个供应商填 `baseUrl + apiKey`，下面挂多个模型
- 对话页选模型时把所有 `enabled` 模型拍平
- 旧版扁平 `models` 数组通过 persist `migrate` 自动迁移

### 浮动音乐播放器

`FloatingMusicPlayer`：

- 右下角浮动，真 `<audio>` 播放，mock 歌单见 `mock/music.ts`
- 右边缘竖条把手：按住上下拖动位置，单击切换 固定/自动隐藏
- 收起后只露毛玻璃边，hover 展开；播放列表根据位置自动向上/下弹

### 对话/知识库侧栏折叠

`CollapsibleSidebar`（对话页、知识库页共用）：

- 默认展开左侧列表（会话/知识库），距顶部 50px 处有一个贴在侧栏右缘的竖条把手
- 点把手收起：侧栏宽度 `width` 动画收到 0，右侧内容区（聊天窗口/详情）顺势左移，获得更大阅读/编辑空间
- 收起后把手仍贴在内容区左缘，点一下重新展开
- 把手只露右半：用一个 `overflow:hidden` 的小窗口贴在右缘，把完整胶囊的左半硬裁掉——**物理裁剪**，不依赖不透明底色，毛玻璃半透明模式下也不会透出左半
- 收起状态存 `settingsStore.sidebarCollapsed`（persist，key `mywork:settings`），跨页面、刷新保留；开关方法 `toggleSidebar()`

### 工具集

- 注册表 `registry.tsx`：加新工具只需加一项 `{ id, name, icon, category, component: React.lazy(...) }`
- 每个工具独立 chunk，按需加载
- 多标签页：切换工具不卸载组件，CSS `display` 切换保留输入状态
- 文本替换工具内置：正则开关、自动复制、近 50 条历史、可拖拽可缩放的 diff 弹窗

### 系统管理（Admin Panel）

仅 `user.role === 'admin'` 可见，左侧导航盾牌图标入口，路由 `/admin/*`。当前全部数据走 `api/admin.ts` mock。

| 子页面   | 路由               | 功能                                                                         |
| -------- | ------------------ | ---------------------------------------------------------------------------- |
| 用户管理 | `/admin/users`   | 用户列表、新增/编辑、禁用启用、重置密码、删除                                |
| 模型目录 | `/admin/models`  | 供应商开关、模型可见性、设默认模型（用户自管 API Key，管理员只控制可选范围） |
| 系统监控 | `/admin/monitor` | 调用量统计卡片 + 7天趋势柱状图、在线会话（可强制下线）、错误日志             |
| 审计日志 | `/admin/audit`   | 登录/操作记录，支持关键词搜索                                                |
| 定时任务 | `/admin/tasks`   | 过期对话清理、过期日志清理、调用量统计快照；可启停、立即执行                 |
| 系统配置 | `/admin/config`  | 注册开关、系统公告、新用户默认主题/模型                                      |

**角色判定**：当前前端按登录用户名 `admin` 推断 role，后端对接后应从登录返回体或 `/auth/me` 接口获取真实 role 字段。

## 环境变量

复制 `.env.development` 为 `.env.local` 并填值（`.env.local` 不提交）：

```bash
VITE_API_BASE=http://localhost:8123/api   # 业务后端（vc-app 监听 8123，context-path=/api）
VITE_LLM_BASE=https://api.openai.com/v1   # 大模型 API
VITE_LARK_APP_ID=                         # 飞书 App ID
VITE_USE_MOCK=true                        # false 时走真实请求
```

## 对接后端

1. `.env.local` 填真实地址，`VITE_USE_MOCK=false`
2. 登录：`api/auth.ts` 把 mock 换成真实 `/api/auth/login`，返回 token 后自动存入 `authStore`
3. `api/chat.ts`、`api/knowledge.ts` 里把 mock 分支换成 `http.get/post`
4. 对话流式：调 `streamChat({ body, onDelta, onDone })`，把 delta 喂给 `useChatStore.appendDelta`
5. 模型配置：`settingsStore.providers` 改为接口拉取，apiKey 走后端加密存储

## 后续规划

- **多模型对话**：真实流式接入（SSE）、对话持久化到后端、中断生成（AbortController）
- **知识库 + 飞书**：真实飞书 OAuth、文档上传、笔记编辑器、RAG 引用
- **数据库可视化**：连接管理、Monaco SQL 编辑器、结果表格、虚拟滚动
- **系统管理后端对接**：将 `api/admin.ts` mock 替换为真实接口（用户 CRUD、模型目录、监控统计、审计日志、定时任务）
- **系统管理增强**：在线用户强制下线接入真实会话管理、调用量统计接真实数据表
