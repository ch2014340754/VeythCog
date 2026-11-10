# Design · P1 导航首页（iTab 风格新标签页）

> 版本：v1.0（2026-11-10）
> 配套：`proposal.md` / `tasks.md`
> 本文档定义：数据模型、后端接口契约、前端组件结构、关键交互时序。

---

## 1. 数据模型（PostgreSQL，脚本 `docs/sql/012_nav.sql`）

### 1.1 `nav_category`（分类表）

| 列 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | BIGSERIAL | PK | 主键 |
| `user_id` | BIGINT | NOT NULL, FK→`app_user.id` | 所属用户（单账号自用，按用户隔离） |
| `name` | VARCHAR(32) | NOT NULL | 分类名（主页 / 后端 / 前端 / 学习 / 工具 / 游戏 / AI） |
| `icon` | VARCHAR(128) | NULL | 分类图标（emoji 或 S3 key，P0 先用 emoji） |
| `sort_order` | INT | NOT NULL DEFAULT 0 | 排序值，越小越靠前 |
| `is_default` | BOOLEAN | NOT NULL DEFAULT FALSE | 是否默认分类（进入首页时选中） |
| `deleted` | BOOLEAN | NOT NULL DEFAULT FALSE | 软删除 |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |

唯一约束：`UNIQUE(user_id, name) WHERE deleted = FALSE`。

### 1.2 `nav_bookmark`（书签表）

| 列 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | BIGSERIAL | PK | |
| `category_id` | BIGINT | NOT NULL, FK→`nav_category.id` | 所属分类 |
| `user_id` | BIGINT | NOT NULL, FK→`app_user.id` | 冗余，便于按用户查询 |
| `title` | VARCHAR(64) | NOT NULL | 显示名（GitHub / MDN / React） |
| `url` | VARCHAR(512) | NOT NULL | 跳转地址 |
| `sort_order` | INT | NOT NULL DEFAULT 0 | 分类内排序 |
| `deleted` | BOOLEAN | NOT NULL DEFAULT FALSE | 软删除 |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |

索引：`(category_id, sort_order)`；`(user_id, deleted)`。

### 1.3 `nav_setting`（用户首页配置表，单行）

| 列 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `user_id` | BIGINT | PK, FK→`app_user.id` | 一人一行 |
| `search_engine` | VARCHAR(16) | NOT NULL DEFAULT 'baidu' | `baidu` / `google` / `bing` |
| `current_wallpaper_key` | VARCHAR(256) | NULL | 锁定的壁纸 S3 key；NULL = 每次随机 |
| `active_category_id` | BIGINT | NULL | 上次选中的分类（进入首页时恢复） |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |

### 1.4 种子数据

- 给 `admin` 用户预置 7 个分类（`sort_order` 10/20/30/40/50/60/70）：
  - 主页 🏠、后端 </>、前端 🎨、学习 📚、工具 🛠、游戏 🎮、AI ✨
- 每个分类预置 2-3 个书签示例（后端常用：GitHub、掘金、Stack Overflow；前端：MDN、React、Can I Use；……）。
- `nav_setting` 给 admin 插一行默认配置（`search_engine=baidu`）。

---

## 2. 后端接口契约（context-path `/api`，统一返回 `BaseResponse<T>`）

> 鉴权：全部接口需登录（沿用现有 JWT 过滤链）。
> 错误码：复用 `ErrorCode`，新增 `NAV_CATEGORY_NOT_FOUND` / `NAV_BOOKMARK_NOT_FOUND` / `NAV_ICON_FETCH_FAILED`。

### 2.1 分类

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/nav/categories` | 列出当前用户所有分类（按 `sort_order` 升序） |
| POST | `/nav/categories` | 新建分类，body: `{name, icon?}` |
| PUT | `/nav/categories/{id}` | 重命名 / 改图标，body: `{name, icon?}` |
| DELETE | `/nav/categories/{id}` | 软删除；`query: migrateTo=未分类` 时把该分类下书签迁到指定分类（不传则连同书签一起软删） |
| PUT | `/nav/categories/reorder` | 批量排序，body: `[{id, sortOrder}]` |
| PUT | `/nav/categories/{id}/default` | 设为默认分类（应用层保证每用户至多 1 个 `is_default=true`） |

### 2.2 书签

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/nav/bookmarks?categoryId={id}` | 列出某分类下书签（按 `sort_order` 升序） |
| POST | `/nav/bookmarks` | 新建书签，body: `{categoryId, title, url}`（图标由前端实时拼 `https://{host}/favicon.ico`，后端不存） |
| PUT | `/nav/bookmarks/{id}` | 编辑书签，body: `{categoryId?, title?, url?}` |
| DELETE | `/nav/bookmarks/{id}` | 软删除 |
| PUT | `/nav/bookmarks/reorder` | 分类内批量排序，body: `{categoryId, items:[{id, sortOrder}]}` |

### 2.3 图标 favicon（前端实现，**后端无接口**）

- 前端根据书签 URL 提取 `{domain}`，直接拼 `<img src="https://{domain}/favicon.ico">`；
- `<img>` 标签不受跨域限制，无需后端代理；
- `onError` 时兜底：渲染一个占位色块（按 URL hash 取色）+ 网站名前 3 字；
- 不再请求 Google/DuckDuckGo favicon service，不做后端缓存。

### 2.4 壁纸

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/nav/wallpaper/random` | 从 S3 `wallpapers` 桶列出所有对象，随机取 1 个 key，走 `S3PresignService.presignGetUrl` 生成 7 天预签名 URL，返回 `{key, url}` |
| GET | `/nav/wallpaper/list` | 列出壁纸清单（key + 预签名小图 URL），供「设置」面板选择 |
| PUT | `/nav/wallpaper/lock` | body: `{key}`，把 `nav_setting.current_wallpaper_key` 设为该 key（传 null 解锁随机） |

### 2.5 用户配置

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/nav/setting` | 读取当前用户 `nav_setting`（不存在则返回默认值） |
| PUT | `/nav/setting` | body: `{searchEngine?, activeCategoryId?}` |

---

## 3. 前端结构（VeythCog-V）

### 3.1 路由

```
/login           → 现有
/home            → 新首页（登录后默认落地页）
/chat, /knowledge, /tools, /admin → 现有工作台
```

- 根路径 `/` 302 到 `/home`（React Router 配置）；
- 未登录访问 `/home` 跳 `/login`。

### 3.2 目录结构

```
src/pages/Home/
├── index.tsx                  # 页面壳：壁纸层 + 居中内容 + 右侧栏 + 顶栏
├── Wallpaper.tsx              # 全屏背景，淡入过渡
├── Clock.tsx                   # 大时钟 + 公历日期（农历用 lunar-javascript）
├── SearchBar.tsx              # 搜索框（搜索引擎下拉 + 回车跳转）
├── BookmarkGrid.tsx            # 两行图标网格 + 「+ 添加图标」
├── BookmarkIcon.tsx            # 单个图标（logo + 名称，hover 显示编辑/删除）
├── CategorySidebar.tsx         # 右侧竖排分类栏（滚轮切换）
├── BookmarkModal.tsx           # 添加/编辑书签弹窗
├── CategoryManageModal.tsx    # 分类管理弹窗（重命名/排序/删除）
└── QuoteBar.tsx                # 底部文案（P0 写死 5 条轮播）
```

### 3.3 Zustand store（`navStore`，persist 关键 key）

```ts
interface NavState {
  categories: Category[];
  activeCategoryId: number | null;
  bookmarks: Bookmark[];           // 当前分类下的书签
  wallpaper: { key: string; url: string } | null;
  searchEngine: 'baidu' | 'google' | 'bing';
  setActiveCategory(id: number): void;
  loadCategories(): Promise<void>;
  loadBookmarks(categoryId: number): Promise<void>;
  loadRandomWallpaper(): Promise<void>;
}
```

persist key：`activeCategoryId`、`searchEngine`（刷新后恢复上次选中的分类与搜索引擎）。

### 3.4 关键交互时序

#### 3.4.1 进入首页

```
App 挂载 → 检查登录态
  → GET /nav/setting（拿 searchEngine + activeCategoryId）
  → GET /nav/categories
  → GET /nav/bookmarks?categoryId={activeCategoryId ?? 默认分类}
  → GET /nav/wallpaper/random（若 current_wallpaper_key 为空）
    或 GET /nav/wallpaper/list 取锁定 key 的预签名 URL
  → 渲染
```

#### 3.4.2 滚轮切换分类（核心）

- **热区：整个图标页面区域**（书签网格主区域，即 `BookmarkGrid` 外层容器），不依赖右侧竖栏可见；
- `BookmarkGrid` 组件外层包 `<div onWheel={handleWheel}>`；
- `handleWheel`：
  ```
  if (debouncePending) return;
  debouncePending = true;
  setTimeout(() => debouncePending = false, 300);

  const currentIdx = categories.findIndex(c => c.id === activeCategoryId);
  if (e.deltaY > 0 && currentIdx < categories.length - 1) {
    setActiveCategory(categories[currentIdx + 1].id);
  } else if (e.deltaY < 0 && currentIdx > 0) {
    setActiveCategory(categories[currentIdx - 1].id);
  }
  ```
- 切换时：书签网格 `opacity: 0 → 1` + `translateY(8px → 0)`，300ms CSS transition；
- 切换后异步 `loadBookmarks(newCategoryId)`，**保留旧书签显示直到新数据返回**（遵循项目「无感刷新」规范：右上角细进度条，不整块 Spin）；
- 调用 `PUT /nav/setting { activeCategoryId }` 持久化（fire-and-forget，失败不影响用户体验）。

#### 3.4.3 右侧竖栏滑入交互

- 平时竖栏 `transform: translateX(100%)` 隐藏在视口右侧外；
- 视口右边缘 20px 热区 `<div>` 监听 `onMouseEnter` → 竖栏 `transform: translateX(0)`，200ms 滑入；
- 鼠标离开竖栏本体后启动 1.5s 延迟计时，计时结束 `transform: translateX(100%)` 滑出；
- 鼠标再次进入竖栏本体时清除计时；
- 竖栏只作为「分类指示器 + 点击入口」，滚轮切分类不依赖它。

#### 3.4.4 添加书签

1. 点「+ 添加图标」→ 弹 `BookmarkModal`；
2. 用户填 `title` + `url`；
3. 失焦时前端提取 `url` 的 host，预览图标直接渲染 `<img src="https://{host}/favicon.ico" onError={...}>`；
4. `onError` 时预览区显示占位色块 + 网站名前 3 字；
5. 保存 → `POST /nav/bookmarks`（body 不带 iconUrl，后端只存 title/url；图标 URL 由前端每次渲染时实时拼）→ 乐观更新到 `bookmarks` 末尾；
6. 失败回滚。

> **设计决策**：书签表不存 `icon_url` 列（或存了但前端不用），图标 URL 由前端每次渲染时根据 `url` 实时拼 `https://{host}/favicon.ico`。好处：① 不用后端代理；② 网站换 favicon 自动生效；③ 减少存储字段。`onError` 兜底逻辑在 `BookmarkIcon` 组件内统一处理。

#### 3.4.4 搜索框

- 搜索引擎下拉：百度 / Google / Bing，选择 persist 到 `navStore`；
- 回车：
  ```ts
  const engineMap = {
    baidu: `https://www.baidu.com/s?wd=${encodeURIComponent(q)}`,
    google: `https://www.google.com/search?q=${encodeURIComponent(q)}`,
    bing: `https://www.bing.com/search?q=${encodeURIComponent(q)}`,
  };
  window.open(engineMap[searchEngine], '_blank');
  ```

---

## 4. 非功能约束

1. **首页加载性能**：壁纸大图走预签名 URL + 懒加载（`loading="lazy"`）；书签网格图标用 `loading="lazy"`；首屏 LCP ≤ 2s。
2. **壁纸淡入**：壁纸 `onLoad` 后 `opacity: 0 → 1`，避免白屏闪烁。
3. **安全**：书签 `url` 后端做白名单校验（只允许 `http://` / `https://`，拒绝 `javascript:` / `data:`）；前端跳转 `window.open` 加 `noopener,noreferrer`。
4. **图标 URL 不存敏感信息**：S3 public-icons 桶是公开只读，图标本身不敏感；私有壁纸 URL 是预签名，有效期 7 天，不落库。
5. **无感刷新**（项目通用规范）：
   - 切分类时不切 `loading`，保留旧书签显示，只在右上角细进度条；
   - 添加/删除书签本地乐观更新，不重拉整列表；
   - 保存配置后不整块 Spin。

---

## 5. 风险点与降级策略

| 风险 | 降级 |
|---|---|
| 各站 `favicon.ico` 加载失败（404 / 跨域拒绝） | `<img onError>` 兜底：渲染占位色块（按 URL hash 取色）+ 网站名前 3 字；不请求 Google/DuckDuckGo favicon service，不做后端代理 |
| S3 wallpapers 桶为空 | 前端用本地默认壁纸（`/public/default-wallpaper.jpg`）兜底，不报错 |
| 滚轮切换误触（书签网格区域滚动） | 热区已拍板为「整个图标页面区域」，书签网格固定两行不溢出，不存在滚动冲突 |
| 分类下有书签想删除 | 后端校验返回 409，前端禁用删除按钮；必须先清空书签 |
| 预签名 URL 过期（7 天内用户一直不刷新） | 不做主动续期；用户刷新首页即重新拉 |
| 右侧竖栏滑入/滑出打断用户操作 | 滑出延迟 1.5s；鼠标进入竖栏本体时清除计时；滑入动画 200ms 不阻塞点击 |
