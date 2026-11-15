# 用户绑定审计（2026-11-15）

> 范围：`VeythCog-C` 全部建表脚本（`docs/sql/001~021`）、各模块实体/服务/Controller，以及 `VeythCog-V` 中所有 `localStorage` / `zustand persist` 落地的数据。
> 判定口径：**同一份数据被两个账号使用时，是否会互相看见 / 互相覆盖**。会 → 缺用户绑定。

## 1. 后端：表级归属

| # | 数据 | 现状 | 证据 | 风险 | 处置 |
|---|---|---|---|---|---|
| 1 | `knowledge_doc`（文档正文/摘要/标签/块结构） | **无 `user_id`**，全站共享。服务层收 `userId` 却从不使用 | `KnowledgeDoc.java` 无 userId 字段；`KnowledgeServiceImpl.list/get/create/update/delete`（L58-175）`userId` 形参全未使用；`KnowledgeController` L121-258 仍按登录用户传参；`021_knowledge_folder.sql`/`009_knowledge.sql` 无该列 | **P0**：任何登录账号都能列出/打开/改写/删除他人文档；`/knowledge/rag/retrieve` 还能跨账号召回他人内容 | 独立变更补 `owner_id`（见 proposal 的 Out of scope + 建议） |
| 2 | `knowledge_folder`（目录树） | **无 `user_id`**，且 Service 接口签名里**根本没有 userId** | `KnowledgeFolderService` L14-39：`tree(keyword)` / `create(parentId,name)` / `rename` / `delete` / `move` / `exportZip`；`021_knowledge_folder.sql` 明确「无 user_id（全站共享）」 | **P0**：目录结构全站共享，A 的目录/文档树对 B 完全可见，重名/移动会互相干扰 | 同上，与文档同批补 `owner_id` |
| 3 | `knowledge_embedding`（分片向量） | 只有 `doc_id`，无归属 | `KnowledgeEmbedding.java`；`VectorizeServiceImpl` | P1（依赖 #1）：补 owner 后检索必须经文档 owner 过滤，否则仍可跨账号召回 | 随 #1 一起改检索 SQL |
| 4 | `chat_message`（对话记忆） | **无 `user_id`**，靠 `conversation_id` 字符串前缀 `userId:conversationId` 冒充隔离 | `006_chat_message.sql` L6/L14 注释；`MyBatisChatMessageRepository` L21；`ChatHistoryService` L50/L93/L110 手工拼/拆前缀；`ChatMessageMapper.xml` 按 `conversation_id` 前缀聚合 | **P1**：无外键、无 `user_id` 索引，按用户统计/清理只能 `LIKE 'id:%'`；客户端可传带 `:` 的 `conversationId` 造成归属歧义；前缀改动即全量数据失效 | 独立变更：加 `user_id` 列 + 回填 + `conversation_id` 回归纯业务 id |
| 5 | `chat_session`（会话配置） | ✅ 已绑 `user_id` | `017_p0_verify_and_session.sql`；`ChatSessionService` | — | — |
| 6 | `nav_setting`（首页配置/壁纸） | ✅ 已绑 `user_id`（一人一行 PK） | `012_nav.sql` L100-111；`NavSettingService` | 语义与「用户偏好」同构，但占用一张专属表 | **本变更已办结（2026-11-15）**：数据迁入 `user_setting` 后 `nav_setting` 已 DROP |
| 7 | `nav_category` / `nav_bookmark` | ✅ 已绑 `user_id`，服务层每次 `requireCategory/requireBookmark` 校验归属 | `NavCategoryService` L34-134；`NavBookmarkService` L47-272；`NavIconService` L149-306 | 后端没有问题（用户感知的「导航没绑定」实际来自前端缓存，见 §2） | 不改 |
| 8 | `app_user`（含 `avatar_key`） | ✅ 天然绑定 | `015_app_user_avatar.sql` | — | — |
| 9 | `user_llm_binding` / `user_llm_model_verify` | ✅ 已绑 `user_id` | `004` / `018` / `019` | — | — |
| 10 | `llm_model`（模型目录）/ `sys_api_*` / `llm_call_log` / `sys_user_session` / `user_role` | 全局目录或系统观测数据，按设计共享；后两者已带 `user_id` | `002` / `016` / `008` | — | 不改 |

## 2. 前端：只存在浏览器里的「用户数据」

所有条目都是 `localStorage` 键，**没有 user 维度**：同一台电脑换账号，数据不会跟着账号走（要么串号，要么丢失）。

| # | 数据 | 位置 | 风险 | 建议 |
|---|---|---|---|---|
| 11 | **数据库连接（含连接串/账号密码）** | `stores/dbStore.ts` → `mywork:db` | **P1**：换账号仍能看到上一个账号的库连接（可能含密码）；换设备则全部丢失；登出**不清理** | 后端表 `db_connection(owner_id, ...)`，密码后端加密（与 LLM Key 同一套 AES） |
| 12 | 模型偏好（当前模型 / 绑定模型列表 / 流式开关） | `stores/settingsStore.ts` → `mywork:settings` | P1：`models`、`currentModelId` 是账号维度数据，却按浏览器持久化，换账号会短暂显示上一账号的模型列表与选中项 | 拆到 `user_setting`（`preferred_vendor/model`、`stream_enabled`） |
| 13 | 飞书绑定（mock） | `stores/authStore.ts` → `mywork:auth` 的 `lark`；`Settings/LarkBind.tsx` 走假 OAuth | P1：完全没有落库，换浏览器即「未绑定」，且与账号无关 | `user_setting` 加 `lark_open_id` / `lark_bound_at`（或独立绑定表） |
| 14 | 主题预设 / 亮暗模式 | `contexts/ThemeContext.tsx` → `theme-preset` / `theme-appearance` | P2：纯外观偏好，换账号沿用上一个账号的设置 | `user_setting` 加 `theme_preset` / `appearance_mode` |
| 15 | 毛玻璃 / 侧栏 / 背景 / 遮罩 | `stores/settingsStore.ts` → `mywork:settings` | P2 同上 | `user_setting` 加 `glass_enabled` / `glass_opacity` / `overlay_opacity` / `sidebar_collapsed` / `background` |
| 16 | 工具收藏 / 搜索历史 / 翻译历史 | `pages/tools/index.tsx` `tools:favorites`；`api/search.ts` `veythcog:search:history`；`TranslatorTool.tsx` `tools:translate:history` | P2：个人偏好/历史，换账号串号 | `user_setting` 加 `tool_favorites text[]`；历史类是否上收另行决定（隐私性更强） |
| 17 | 工具标签页工作区 | `stores/toolTabsStore.ts` → `mywork:tool-tabs` | P3：临时 UI 状态，浏览器级可接受 | 不改（登出清理即可） |
| 18 | 前端 mock 残留：`mywork:chat`（会话/消息）、`mywork:knowledge`（notes/bases） | `stores/chatStore.ts`、`stores/knowledgeStore.ts` | P2：真实数据已在后端，这两份是死数据，会让排查误判「对话没绑用户」 | 清理这两个 persist（或只 persist `currentId`） |
| 19 | 书签图标地址缓存 | `utils/iconCache.ts` → `veythcog:nav-icons:v1` | 无风险（纯缓存，按图标字段签名失效） | 不改 |

## 3. 登出清理缺口

`authStore.logout()`（`stores/authStore.ts` L52-55）只清 `token/user/lark`；`navStore.reset()` 仅在首页登出时调用。**`dbStore` / `settingsStore` / `toolTabsStore` / 主题 `localStorage` / 搜索历史 / 收藏均不清理** → 同浏览器换账号串数据。这是用户感知「导航/分类没跟账号走」的直接原因（`navStore` 会先用本地快照渲染，再静默覆盖）。

## 4. 结论

- 后端真正缺归属的只有 **知识库文档 + 目录（P0）** 和 **对话消息（P1 结构性缺陷）**；导航/分类/会话配置/模型绑定都已正确绑定。
- `nav_setting` 是唯一一张「只为放几个用户偏好而单独建的表」，把它换成统一表是这次变更的主线；同时给前端偏好（#12~#16）留好落点。
- 统一表只收**用户偏好/设置**（标量为主）。**业务数据（文档、消息）不塞进统一表**，它们必须各自带 `owner_id`，否则无法做行级权限、无法按用户清理。
