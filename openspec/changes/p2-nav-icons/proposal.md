# Proposal · P2 导航书签自定义图标（S3 图标资产 + 自定义弹窗）

> 版本：v1.0（2026-11-12）
> 状态：已随本轮需求直接进入 apply（用户明确要求实现，设计与实现同批交付）

## 为什么做（Why）

P1 导航首页为了省掉后端接口，书签图标由前端每次渲染时拼 `https://{host}/favicon.ico`：

- 依赖站点自身是否暴露 `favicon.ico`，很多站点 404 / 被 CDN 拦截，只能显示文字占位；
- 每开一次新标签页都要向 N 个第三方站点发请求，慢且不稳定；
- 无法自定义图标：现在「新增 / 编辑图标」弹窗只有网址 + 名称，用户想换图标没有任何入口。

需求目标：

1. 「新增 / 编辑图标」弹窗按 iTab 截图改造，支持**从网址获取图标、上传图片、文字图标（文字 + 颜色）**；
2. 现有 18 条书签的网站图标**统一同步进 S3 `public-icons` 桶**，导航页不再实时依赖第三方站点；
3. 导航页图标加载顺序固定为：**前端缓存 → 缓存未命中再向后端取数据库里的 S3 图标地址**；
4. 自定义上传的图标同样进 `public-icons` 并绑定到书签。

## 做什么（What）

- 书签表增加图标来源字段：`icon_type`（`auto` / `upload` / `text`）、`icon_key`（S3 对象 key）、`icon_text`、`icon_color`、`icon_synced_at`；
- 后端 `vc-nav` 增加：
  - 站点图标抓取器（解析 HTML `<link rel=icon>`，回退 `/favicon.ico`、`/apple-touch-icon.png`），校验真实图片格式后上传 S3；
  - 自定义图标上传（`multipart`，≤512KB，png/jpg/webp/gif/ico）；
  - 图标解析接口：按书签 id 返回 `{type, url, text, color}`，先查进程内缓存，未命中再查 DB 并拼 `public-icons` 直链；
  - 幂等同步接口 + 启动时后台补同步（只补 `icon_type=auto` 且没有 `icon_key` 的书签，失败按 1 天冷却重试）；
- 前端：
  - `BookmarkModal` 按截图重做：网址 + 「获取图标」、名称、文字图标 / 上传 / 网站图标三选一、图标文字、图标颜色、保存 / 保存并继续；
  - `BookmarkIcon` 改为「本地 localStorage 图标描述缓存 → 未命中请求 `/nav/bookmarks/{id}/icon`」；文字图标无需请求；
  - 首页发现仍有未同步的自动图标时，后台触发一次同步并静默刷新书签列表。

## 不做什么（Out of scope）

- ❌ 图标裁剪 / 主题化 / 多尺寸生成：只存原始上传图片，前端按 34px 显示；
- ❌ SVG 上传：`public-icons` 是公开只读桶，SVG 可携带脚本，明确拒绝；
- ❌ 跨用户图标共享：仍按 `user_id` 隔离，单账号自用；
- ❌ 图标变更历史 / 回滚；
- ❌ 把壁纸桶改成公开桶（保持私有 + 预签名）。

## 影响面

### 数据库
- `013_nav_bookmark_icon.sql`：给 `nav_bookmark` 加 5 列（幂等 `IF NOT EXISTS`）+ `icon_type` 约束；
- `012_nav.sql` 同步更新新建表结构（全新库执行 012 + 013 结果一致）。

### 后端
- `vc-nav`：`NavBookmark` 实体 / `BookmarkCreateRequest` / `BookmarkUpdateRequest` / `NavBookmarkService` / 新增 `BookmarkView`、`NavIconView`、`IconUploadResult`、`IconSyncResult`、`SiteIconFetcher`、`NavIconService`、`NavIconStartupSync`；
- `vc-app`：`NavBookmarkController` 增加 `GET /{id}/icon`；新增 `NavIconController`（`/nav/icons/fetch`、`/upload`、`/sync`）；
- `application.yml`：`nav.icon.sync-on-startup`。

### 前端
- `src/api/client.ts`：补 multipart 上传封装；
- `src/api/nav.ts`：书签图标字段、`getBookmarkIcon`、`fetchSiteIcon`、`uploadIcon`、`syncIcons`；
- `src/utils/iconCache.ts`：localStorage 图标描述缓存（带签名失效）；
- `src/pages/Home/BookmarkModal.tsx`：重做；
- `src/pages/Home/BookmarkIcon.tsx`：缓存优先渲染；
- `src/pages/Home/index.tsx`：未同步图标兜底触发同步。

## 验收总则（可演示）

1. 右键空白处 →「新增图标」：填网址后点「获取图标」，能拿到站点图标并回填名称（名称为空时）；保存后网格出现真实图标；
2. 选「上传」：选一张 png，立即预览；保存后刷新页面图标仍在（已进 S3，不是 blob 临时地址）；
3. 选「文字图标」：填 1~3 个字符、选颜色，保存后网格显示同色文字块；
4. 编辑已有书签：能保留原图标、改文字 / 重传 / 重新获取，保存后网格即时更新；
5. 现有书签：启动后端后日志可见补同步，`public-icons` 桶出现 `icons/2026/11/12/*` 对象；导航页图标不再请求第三方站点（浏览器 Network 只看到 S3 直链）；
6. 图标加载：首次打开 localStorage 无缓存 → 每个有图书签各请求一次 `/nav/bookmarks/{id}/icon`；二次进入无该请求（命中缓存）；
7. 「保存并继续」：保存后弹窗不关闭、表单复位，可继续添加下一条。
