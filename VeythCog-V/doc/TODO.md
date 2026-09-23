# TODO - 待办事项

## ✅ 已完成

### 项目基座

- [x] Vite + React 18 + TypeScript + AntD 5 + React Router 6
- [x] 6 套主题预设（紫晶/琥珀/翡翠/靛蓝/玫瑰/石墨）× 亮暗两模式
- [x] 双轨颜色机制（colors 直接值 + CSS 变量）
- [x] @fontsource 本地字体，无外部 CDN
- [x] 品牌 Logo（VeythCogLogo，useId 防冲突）

### 对话页（mock 阶段）

- [x] 会话列表（hover 删除动画、Popconfirm、重命名、搜索）
- [x] 消息 Markdown 渲染（react-markdown）
- [x] 消息 hover 复制 / 重新生成
- [x] 连续 AI 消息头像去重
- [x] 推荐问题 chip
- [x] 切换会话淡入动画
- [x] 输入框工具行

### 工具集（24 个）

- [x] 工具注册表 + 二级侧栏 + 卡片首页
- [x] 多标签页切换（切换不丢组件状态，可关闭）
- [x] JSON：格式化、↔YAML、JSONPath
- [x] 编码：Base64、URL、Hex、JWT
- [x] 哈希：MD5/SHA1/SHA256/SHA512
- [x] 文本：正则测试、命名风格、Diff、Markdown 预览、字数统计、文本替换
- [x] 时间：时间戳、时区
- [x] 代码：SQL 格式化、cURL 转换、Cron 解释
- [x] 其他：UUID、密码生成、进制、颜色取色器、图片转 Base64
- [x] 文本替换：正则开关、自动复制、近 50 条历史、可拖拽可缩放 diff 弹窗

### P0 基础设施（本轮完成）

- [x] 环境变量体系（.env.development / .env.production / env.d.ts / config/）
- [x] HTTP 封装（api/client.ts：baseURL / token / 401 / 超时 / 统一错误）
- [x] SSE 流式封装（api/sse.ts：fetch + ReadableStream，支持 abort）
- [x] 本地持久化（utils/storage.ts：命名空间 + TTL）
- [x] Zustand 全局状态（5 个 slice，persist 自动持久化）
- [x] ErrorBoundary 崩溃兜底
- [x] 通用 UI 骨架（EmptyState / LoadingState / ErrorState / PageHeader）
- [x] 业务类型补全（ModelConfig / DBConnection / QueryResult / Note / ToolTab）

### 账号与用户体系（本轮完成，mock 阶段）

- [x] 登录页 `/login`（账号密码 mock + 一键进入）
- [x] authStore（token / user / 飞书绑定状态，persist）
- [x] 路由守卫 RequireAuth（未登录跳 /login，登录后回跳来源页）
- [x] 401 自动清理 token 并跳登录
- [x] 用户头像下拉菜单（MainLayout 底部，替换原调色板按钮）
- [x] 独立设置页 `/settings`：账号 / 模型配置 / 飞书绑定 / 外观 四个 tab
- [x] 设置弹窗 SettingsModal：用户菜单点设置项在当前页弹出，不跳路由，便于边切主题边对比
- [x] 账号信息编辑（昵称 / 邮箱 / 修改密码 mock）
- [x] 模型供应商管理：多供应商 baseUrl + apiKey，每供应商下挂多模型（启用/禁用/增删改）
- [x] 飞书账号绑定 / 解绑（mock 授权流程）
- [x] 主题预设 + 亮暗模式从导航栏 Popover 迁移到"外观"设置页
- [x] settingsStore 结构升级：扁平 models → providers 分组（含 persist 迁移）

### 全局毛玻璃（本轮完成）

- [x] settingsStore 加 `glassEnabled` 开关（persist）
- [x] ThemeContext 监听开关，给 body 加/去 `glass-on` class，surface 改半透明
- [x] global.css 浮层/卡片毛玻璃覆盖（blur+saturate+顶部内高光+外阴影）
- [x] 输入框/按钮边缘毛玻璃（轻 blur，避免文字发糊）
- [x] 导航/列表选中态毛玻璃（主导航、设置菜单、播放列表）
- [x] 业务卡片 `.glass-panel` class 统一吃毛玻璃

### 浮动音乐播放器（本轮完成，mock 阶段）

- [x] FloatingMusicPlayer 全局浮动组件（右下角，真 `<audio>` 播放）
- [x] mock 歌单（SoundHelix 示例 mp3，可真实播放）
- [x] 播放/暂停/上一首/下一首/进度条/时间显示
- [x] 音量控制 + 静音
- [x] 播放列表面板（根据播放器位置自动向上/下弹出，避免被屏幕边截断）
- [x] 右边缘竖条把手：按住上下拖动位置，单击切换 固定/自动隐藏
- [x] 收起态：只露毛玻璃边，hover 展开；自动隐藏时播放列表一并关闭

### 对话/知识库侧栏折叠（本轮完成）

- [x] `CollapsibleSidebar` 外壳组件（对话页会话列表、知识库页共用）
- [x] 距顶 50px 的竖条把手，点按收起/展开，侧栏宽度平滑动画到 0
- [x] 收起后右侧内容顺势左移，把手仍贴在内容区左缘可点回
- [x] 把手只露右半（`overflow:hidden` 裁剪窗口硬裁左半，毛玻璃半透明下不透）
- [x] 收起状态走 `settingsStore.sidebarCollapsed`（persist），跨页面/刷新保留

---

## 🔴 高优先级（下一阶段）

### 多模型对话（P0：前后端串联已打通）

- [x] 模型配置面板（后端绑定管理）—— /settings/providers 已改为拉 `/llm/catalog` 绑定/解绑/设默认
- [x] 接入真实 LLM API（`api/chat.ts` 的 sendMessage → `POST /chat/message` 后端路由 vendor/modelCode）
- [x] 后端多模型路由（供应商枚举 dashscope/deepseek + 用户绑定 + LlmModelRouter）
- [x] 对话页模型选择器（无绑定空态引导；默认模型自动选中；会话内锁定）
- [x] 登录切真实 JWT（`POST /auth/login`，admin/admin123）
- [ ] 对话消息持久化到后端（仍为前端内存 mock，Phase 1）
- [ ] 中断生成按钮（用 AbortController，SSE Phase 1 一并做）
- [ ] SSE 流式（Phase 1 专项）

### 知识库 + 飞书

- [x] 飞书 OAuth 登录 / App ID 配置 —— mock 绑定流程已就绪，真实 OAuth 待接
- [ ] 文档上传（拖拽 + 进度条）
- [ ] 笔记编辑器（Markdown / 富文本）
- [ ] 飞书文档双向同步（读飞书 → 写入本地笔记）

### 数据库可视化

- [ ] 数据库连接管理 UI（CRUD 连接配置）
- [ ] Monaco SQL 编辑器
- [ ] 查询结果表格（虚拟滚动）
- [ ] 历史查询记录

---

## 🟡 中优先级

- [ ] 代码高亮（highlight.js / prism 接入 Markdown 渲染）
- [ ] 知识库全文搜索
- [ ] 虚拟滚动（长消息列表 / 大结果集）
- [ ] 对话中引用知识库内容（RAG 引用卡片）
- [ ] 会话列表排序（按时间 / 按名称）
- [ ] 快捷键支持（Ctrl+K 搜索、Ctrl+N 新对话等）

---

## 🟢 低优先级

- [ ] 主题自定义（用户自定义主色）
- [ ] 主题导入 / 导出
- [ ] 消息打字机效果（已接 SSE 后自然实现）
- [ ] i18n
- [ ] 单元测试 / E2E 测试
- [ ] ESLint + Prettier 严格配置
- [ ] CI/CD

---

## 📋 后端对接清单

> 把 `api/*.ts` 里的 mock 换成真实请求时对照

| 模块 | 当前 mock 函数 | 目标接口 | 状态 |
|---|---|---|---|
| 登录 | `login()` / `getCurrentUser()` | `POST /api/auth/login` | ✅ 已对接（真 JWT） |
| 飞书绑定 | `mockLarkBind()` | `GET /api/auth/lark/url`、`POST /api/auth/lark/callback` | ⬜ |
| 对话 | `getConversations()` | `GET /api/conversations`（Phase 1 持久化） | ⬜ |
| 对话 | `getConversation(id)` | `GET /api/conversations/:id` | ⬜ |
| 对话 | `createConversation()` | `POST /api/conversations` | ⬜ |
| 对话 | `deleteConversation(id)` | `DELETE /api/conversations/:id` | ⬜ |
| 对话 | `sendMessage()` | `POST /api/chat/message`（同步，P0） | ✅ 已对接 |
| 多模型 | `getModels()` | `GET /api/llm/models` | ✅ 已对接 |
| 多模型 | `getCatalog()` | `GET /api/llm/catalog` | ✅ 已对接 |
| 多模型 | `bindModel/unbindModel/setDefaultModel()` | `/api/llm/bindings*` | ✅ 已对接 |
| 知识库 | `getKnowledgeBases()` | `GET /api/knowledge-bases` | ⬜ |
| 知识库 | `createKnowledgeBase()` | `POST /api/knowledge-bases` | ⬜ |
| 知识库 | `deleteKnowledgeBase(id)` | `DELETE /api/knowledge-bases/:id` | ⬜ |
| 知识库 | `uploadDocument()` | `POST /api/knowledge-bases/:id/documents` | ⬜ |
| 笔记 | （待建） | `GET/POST/PUT /api/notes` | ⬜ |
| 音乐 | `mockTracks` | `GET /api/music/tracks`、`GET /api/music/stream/:id` | ⬜ |
| 数据库 | （待建） | `POST /api/query`（执行 SQL） | ⬜ |

**对接步骤**：
1. `.env.local` 填 `VITE_API_BASE`、`VITE_LLM_BASE`，`VITE_USE_MOCK=false`
2. 登录后 `storage.set('auth:token', xxx)`
3. `api/chat.ts` / `api/knowledge.ts` 里把 mock 分支删掉，用 `http.get/post`
4. 对话流式用 `streamChat()`，delta 调 `useChatStore.appendDelta()`
