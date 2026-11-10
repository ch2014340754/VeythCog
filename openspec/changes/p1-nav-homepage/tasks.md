# Tasks · P1 导航首页（iTab 风格新标签页）

> 版本：v1.0（2026-11-10）
> 执行顺序：先 P0 后端（表 + 接口）→ P0 前端（首页壳 + 核心交互）→ 联调验收。
> 每个任务完成后打 `[x]`；编译/运行不通过的任务不算完成。

---

## 阶段 0：准备（0.5d）

- [ ] 0.1 评审 `proposal.md` / `design.md`，用户拍板「风险点」5 条（滚轮热区、图标来源、壁纸预签名、分类删除策略、根路径是否 302）
- [ ] 0.2 在 S3 `wallpapers` 桶预上传 20 张壁纸（命名 `wallpaper-{01..20}.jpg`）
- [ ] 0.3 确认 `vc-nav` 模块包名 `com.vc.nav`，与现有模块命名风格一致

## 阶段 1：后端 · 建表与种子（0.5d）

- [ ] 1.1 新建 `VeythCog-C/docs/sql/012_nav.sql`：
  - 建 `nav_category` / `nav_bookmark` / `nav_setting` 三表
  - 加索引（`nav_bookmark(category_id, sort_order)`、`nav_category(user_id, deleted)`）
  - 加唯一约束（`nav_category(user_id, name) WHERE deleted = FALSE`）
- [ ] 1.2 种子数据：admin 用户 7 个分类 + 每分类 2-3 个示例书签 + `nav_setting` 默认行
- [ ] 1.3 在个人服务器 PG 库执行 `012_nav.sql`，`\d` 验证表结构与索引

## 阶段 2：后端 · vc-nav 模块（1.5d）

- [ ] 2.1 新建 `VeythCog-C/vc-nav/` Maven 模块：
  - `pom.xml` 依赖 `vc-common`
  - 包结构：`com.vc.nav.{entity, mapper, service, controller, dto, enums}`
- [ ] 2.2 实体 + Mapper：
  - `NavCategory` / `NavBookmark` / `NavSetting` 实体（MyBatis-Plus 注解，软删除 `@TableLogic`）
  - `NavCategoryMapper` / `NavBookmarkMapper` / `NavSettingMapper`（继承 BaseMapper）
- [ ] 2.3 `vc-app/pom.xml` 增加 `vc-nav` 依赖
- [ ] 2.4 `SecurityConfig` 确认 `/nav/**` 在 JWT 过滤链内（默认即需登录，无需额外放行）
- [ ] 2.5 分类接口（`NavCategoryController`）：
  - [ ] `GET /nav/categories`（按 sort_order 升序）
  - [ ] `POST /nav/categories`
  - [ ] `PUT /nav/categories/{id}`
  - [ ] `DELETE /nav/categories/{id}`（**分类下有书签时返回 409，前端禁用删除按钮**；清空书签后才可删；不做迁移逻辑）
  - [ ] `PUT /nav/categories/reorder`（批量排序）
  - [ ] `PUT /nav/categories/{id}/default`（应用层清同用户其他 default）
- [ ] 2.6 书签接口（`NavBookmarkController`）：
  - [ ] `GET /nav/bookmarks?categoryId={id}`
  - [ ] `POST /nav/bookmarks`（URL 白名单校验：仅 http/https）
  - [ ] `PUT /nav/bookmarks/{id}`
  - [ ] `DELETE /nav/bookmarks/{id}`
  - [ ] `PUT /nav/bookmarks/reorder`
- [ ] 2.7 ~~图标 favicon 代理接口~~（**拍板取消**：前端直接拼 `https://{domain}/favicon.ico`，onError 用「网站名前 3 字 + 占位色块」兜底，后端无此接口）
- [ ] 2.8 壁纸接口（`NavWallpaperController`）：
  - [ ] `GET /nav/wallpaper/random`（复用 `S3StorageClient.listObjects` 或 `S3PresignService`，随机取 1 个 key，预签名 7 天）
  - [ ] `GET /nav/wallpaper/list`（清单 + 预签名小图 URL）
  - [ ] `PUT /nav/wallpaper/lock`（写 `nav_setting.current_wallpaper_key`，传 null 解锁）
- [ ] 2.9 用户配置接口（`NavSettingController`）：
  - [ ] `GET /nav/setting`（不存在返回默认值）
  - [ ] `PUT /nav/setting`（`searchEngine` / `activeCategoryId`）
- [ ] 2.10 全局异常：`GlobalExceptionHandler` 补 `NAV_CATEGORY_NOT_FOUND` / `NAV_BOOKMARK_NOT_FOUND` / `NAV_ICON_FETCH_FAILED`
- [ ] 2.11 用 knife4j（`/api/doc.html`）逐个接口手测：登录拿 token → 分类 CRUD → 书签 CRUD → favicon 抓取 → 壁纸预签名

## 阶段 3：前端 · API 与 Store（0.5d）

- [ ] 3.1 新建 `src/api/nav.ts`：
  - `getCategories` / `createCategory` / `updateCategory` / `deleteCategory` / `reorderCategories` / `setDefaultCategory`
  - `getBookmarks(categoryId)` / `createBookmark` / `updateBookmark` / `deleteBookmark` / `reorderBookmarks`
  - ~~`fetchFavicon(url)`~~（**拍板取消**：前端直接拼 `https://{host}/favicon.ico`，onError 兜底）
  - `getRandomWallpaper` / `listWallpapers` / `lockWallpaper(key)`
  - `getNavSetting` / `updateNavSetting`
- [ ] 3.2 新建 `src/stores/navStore.ts`（Zustand + persist）：
  - state：`categories` / `activeCategoryId` / `bookmarks` / `wallpaper` / `searchEngine`
  - actions：`loadCategories` / `loadBookmarks` / `loadRandomWallpaper` / `setActiveCategory`
  - persist：`activeCategoryId` + `searchEngine`

## 阶段 4：前端 · 首页壳与核心组件（2d）

- [ ] 4.1 路由配置：`/home` → `Home`；`/` 302 到 `/home`；未登录访问 `/home` 跳 `/login`
- [ ] 4.2 `Home/index.tsx` 页面壳：
  - 全屏壁纸层（`Wallpaper.tsx`，`onLoad` 后淡入）
  - 居中内容容器（时钟 + 搜索框 + 书签网格）
  - 右侧竖排分类栏（`CategorySidebar.tsx`）
  - 顶栏右上角头像 + 下拉（工作台 / 切换壁纸 / 退出）
- [ ] 4.3 `Wallpaper.tsx`：
  - 调 `getRandomWallpaper` 或读 `navSetting.current_wallpaper_key` 取预签名 URL
  - 壁纸为空时用 `/public/default-wallpaper.jpg` 兜底
- [ ] 4.4 `Clock.tsx`：
  - 实时走秒（`setInterval` 1s）
  - 显示 `HH:mm` + 公历日期 + 星期
  - 接入 `lunar-javascript` 显示农历（P0 顺手做，成本低）
- [ ] 4.5 `SearchBar.tsx`：
  - 圆角搜索框 + 左侧搜索引擎下拉（百度 / Google / Bing）
  - 回车 `window.open(engineMap[engine], '_blank', 'noopener,noreferrer')`
- [ ] 4.6 `BookmarkGrid.tsx`：
  - 两行网格，每行最多 10 个，响应式（宽屏 10 / 中屏 8 / 窄屏 6）
  - 最后一个是「+ 添加图标」卡片
  - 切换分类时 `opacity/translateY` 300ms 过渡
  - **整个网格外层容器 `onWheel` 切分类**（debounce 300ms，上滚切上一个、下滚切下一个）——热区覆盖整个图标页面区域，不依赖右侧竖栏可见
- [ ] 4.7 `BookmarkIcon.tsx`：
  - 图标：前端从 `url` 提取 host，拼 `<img src="https://{host}/favicon.ico">`；`onError` 兜底为「占位色块（按 URL hash 取色）+ 网站名前 3 字」
  - hover 显示编辑 / 删除小按钮
  - 点击图标 `window.open(url, '_blank', 'noopener,noreferrer')`
- [ ] 4.8 `CategorySidebar.tsx`：
  - **平时隐藏**：`transform: translateX(100%)`，不在视口内
  - 视口右边缘 20px 热区 `<div>` 监听 `onMouseEnter` → 竖栏 `transform: translateX(0)`，200ms 滑入
  - 鼠标离开竖栏本体后启动 1.5s 延迟计时，计时结束滑出；鼠标再次进入竖栏本体时清除计时
  - 纵向排列分类（emoji + 名称），当前分类高亮（白色 + 毛玻璃）
  - 末尾「+」按钮新建分类
  - 竖栏只作「指示器 + 点击入口」，滚轮切分类由 `BookmarkGrid` 负责
- [ ] 4.9 `BookmarkModal.tsx`：
  - 字段：标题 / URL（**不做图标字段**——图标由前端实时拼 `https://{host}/favicon.ico`，onError 兜底）
  - URL 失焦时预览图标（同 `BookmarkIcon` 的 onError 兜底逻辑）
  - 保存乐观更新到 `bookmarks` 末尾
- [ ] 4.10 `CategoryManageModal.tsx`：
  - 分类列表（重命名 / 上移 / 下移 / 删除）
  - **删除按钮规则**：分类下有书签时禁用删除（提示「请先清空该分类下的书签」）；后端 409 时前端捕获并提示
  - 不做「连同书签一起删除」/「迁移到未分类」的二选一
- [ ] 4.11 `QuoteBar.tsx`：底部写死 5 条文案轮播（5s 切换）

## 阶段 5：联调与验收（0.5d）

- [ ] 5.1 启动后端 `mvn -pl vc-app -am spring-boot:run`（:8123）+ 前端 `npm run dev`（:3000）
- [ ] 5.2 按 `proposal.md` §验收总则 7 条逐条手测：
  - [ ] 登录后自动进入 `/home`，全屏壁纸 + 时钟走秒
  - [ ] 搜索框切换三引擎，回车跳转正确
  - [ ] 整个图标页面区域滚轮切换分类，书签淡入淡出（不依赖右侧竖栏可见）
  - [ ] 鼠标靠近右边缘时右侧竖栏滑入，离开后延迟 1.5s 滑出
  - [ ] 添加书签自动用各站 favicon.ico，失败用「网站名前 3 字 + 占位色块」
  - [ ] 书签编辑 / 删除生效
  - [ ] 分类管理（重命名 / 新增 / 删除）生效；分类下有书签时删除按钮禁用
  - [ ] 未登录访问 `/home` 跳登录
- [ ] 5.3 无感刷新规范走查：切分类不整块 Spin、添加书签不重拉列表、保存配置不闪
- [ ] 5.4 边界用例：
  - [ ] 分类下书签为空 → 显示空态引导「添加第一个书签」
  - [ ] S3 壁纸桶为空 → 本地默认壁纸兜底
  - [ ] favicon.ico 加载失败 → 占位色块 + 网站名前 3 字
  - [ ] 分类下有书签时删除 → 后端 409 + 前端提示「请先清空该分类下的书签」
- [ ] 5.5 编译门禁：后端 `mvn compile` 通过、前端 `npm run build`（tsc + vite）通过

## 阶段 6：文档同步（0.5d）

- [ ] 6.1 更新 `PROJECT_MEMORY.md`：
  - §1 布局：补 `vc-nav` 模块
  - §3 模块职责：补 `com.vc.nav`
  - §5 数据模型：补 3 张表
  - §6 接口：补 `/nav/**` 接口清单
  - §7 前端：补 `/home` 路由与 `navStore`
  - §10 待办：移除已完成项
- [ ] 6.2 把本目录（`openspec/changes/p1-nav-homepage/`）归档到 `openspec/changes/archived/` 或保留待后续归档流程
- [ ] 6.3 更新 `信息基准` 日期为当天

---

## 工作量估算

| 阶段 | 估时 |
|---|---|
| 0 准备 | 0.5d |
| 1 建表 | 0.5d |
| 2 后端模块 | 1.5d |
| 3 前端 API+Store | 0.5d |
| 4 前端组件 | 2d |
| 5 联调验收 | 0.5d |
| 6 文档同步 | 0.5d |
| **合计** | **6d** |

> P0 聚焦核心闭环，不做拖拽排序 / 壁纸上传 / 农历节气文案 / 导入导出。这些在 P1/P2 单独立项。
