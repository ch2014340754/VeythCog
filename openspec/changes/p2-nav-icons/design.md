# Design · P2 导航书签自定义图标

> 版本：v1.0（2026-11-12）
> 配套：`proposal.md` / `tasks.md`
> 本文档定义：数据模型、图标来源与同步策略、接口契约、缓存层级、前端弹窗结构。

---

## 1. 数据模型（`nav_bookmark` 增量）

| 列 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `icon_type` | VARCHAR(16) | NOT NULL DEFAULT `'auto'` | `auto` 站点自动抓取 / `upload` 自定义上传 / `text` 文字图标 |
| `icon_key` | VARCHAR(256) | NULL | `public-icons` 对象 key（形如 `icons/2026/11/12/uuid.png`） |
| `icon_text` | VARCHAR(16) | NULL | 文字图标内容（1~3 个字符） |
| `icon_color` | VARCHAR(16) | NULL | 文字图标底色 `#RRGGBB` |
| `icon_synced_at` | TIMESTAMPTZ | NULL | 最近一次抓取尝试时间（成功 / 失败都写，用于失败冷却） |

约束：`CHECK (icon_type IN ('auto','upload','text'))`。

迁移：`docs/sql/013_nav_bookmark_icon.sql`（幂等）；`012_nav.sql` 的新建表同步包含以上列。旧 18 条书签 `icon_type` 自动取默认 `auto`、`icon_key` 为空，由启动同步补齐。

---

## 2. 图标来源与同步策略

### 2.1 站点图标抓取（`SiteIconFetcher`）

输入必须是 `http/https` 书签 URL。流程：

1. SSRF 防护：解析 DNS，拒绝 loopback / 私网 / link-local / 组播 / `localhost`；重定向后的最终 URI 同样校验；
2. 抓页面 HTML（≤512KB，6s 超时），正则提取 `rel` 含 `icon` 的 `<link>` 的 `href`，相对地址按最终页面 URL 解析；同时取 `<title>` 作为名称建议；
3. 候选顺序：页面声明的 icon → 同源 `/favicon.ico` → `/apple-touch-icon.png` → `/apple-touch-icon-precomposed.png`，最多试 6 个；
4. 每个候选读取 ≤512KB，用文件头魔数识别真实类型（png/jpeg/gif/webp/bmp/ico），**不信任后缀与 Content-Type**；SVG 直接丢弃；
5. 成功即返回 `{bytes, extension, mime, sourceUrl, siteTitle}`。

失败统一抛 `BusinessException(PARAMS_ERROR, "未能获取网站图标…")`，前端提示后允许改上传 / 文字图标。

### 2.2 上传到 S3

- 桶：`S3Bucket.PUBLIC_ICONS`（公开只读，已存在并验证匿名可读：不存在对象返回 404 而非 403）；
- key：`S3ObjectKeyUtils.buildKey("icons", "favicon." + ext)` → `icons/{yyyy}/{MM}/{dd}/{uuid}.{ext}`；
- Content-Type 写魔数识别出的真实 MIME；
- 公开地址：`S3PresignService.publicUrl(PUBLIC_ICONS, key)`（`storage.s3.public-endpoint` 为空时用 `endpoint`）。

### 2.3 自定义上传

- `multipart file`：≤512KB；后缀白名单 `png/jpg/jpeg/webp/gif/ico`；MIME 白名单 `image/png|jpeg|webp|gif|x-icon|vnd.microsoft.icon`；魔数与后缀一致性由 `S3FileValidator` 校验；
- 上传成功返回 `{iconKey, iconUrl}`，前端保存时把 `iconKey` 写进书签；
- 保存时后端再次校验 `iconKey` 必须位于 `icons/` 前缀且对象存在，避免前端伪造 key 绑定其它对象。

### 2.4 同步任务

- `NavIconService.syncMissing(userId, limit)`：只挑 `icon_type='auto'`、`icon_key` 为空、且 `icon_synced_at` 为空或早于 1 天前的书签；逐条抓取 + 上传 + 回写 `icon_key/icon_synced_at`；
- 启动时 `NavIconStartupSync` 监听 `ApplicationReadyEvent`，投递到 2 线程池后台执行（`nav.icon.sync-on-startup=true` 才启用），不阻塞启动；
- 手动接口 `POST /nav/icons/sync`：同步当前用户缺失图标，同步返回 `{total, success, failed}`；
- 失败的记录也写 `icon_synced_at=now()`，避免每次启动立刻重试同一批失败站点，1 天后再试；
- 新建书签如果 `icon_type=auto` 且没有 `icon_key`，插入后异步同步一次。

---

## 3. 接口契约（context-path `/api`，统一 `BaseResponse<T>`）

> 全部需登录；`/nav/**` 沿用现有 JWT 过滤链。

### 3.1 书签列表（扩展返回字段）

`GET /nav/bookmarks?categoryId={id}` → `BookmarkView[]`

```json
{
  "id": 12,
  "categoryId": 3,
  "userId": 1,
  "title": "GitHub",
  "url": "https://github.com",
  "sortOrder": 10,
  "iconType": "auto",
  "iconKey": "icons/2026/11/12/xxx.png",
  "iconText": null,
  "iconColor": null,
  "iconSyncedAt": "2026-11-12T10:00:00+08:00",
  "hasIcon": true
}
```

> 列表**不返回** `iconUrl`：图片地址由图标接口按需解析，前端先查本地缓存。

### 3.2 图标解析（缓存 → DB）

`GET /nav/bookmarks/{id}/icon` → `NavIconView`

```json
{ "type": "auto", "url": "http://…/public-icons/icons/2026/11/12/xxx.png", "text": null, "color": null }
```

- 服务端一级缓存：`ConcurrentHashMap<bookmarkId, {signature, view, expiresAt}>`，TTL 10 分钟；签名 = `iconType|iconKey|iconText|iconColor|iconSyncedAt`；
- 未命中 → 查 DB（校验归属）→ `icon_key` 拼 S3 公开直链；
- `icon_type=text` 直接返回文字与颜色，`url=null`；
- `icon_key` 为空时返回 `url=null`，前端用文字占位兜底。

### 3.3 从网址获取图标

`POST /nav/icons/fetch` body `{ "url": "https://github.com" }` → `IconUploadResult`

```json
{ "iconKey": "icons/2026/11/12/xxx.png", "iconUrl": "http://…/public-icons/icons/…png", "title": "GitHub", "sourceUrl": "https://github.com/favicon.ico" }
```

### 3.4 上传自定义图标

`POST /nav/icons/upload` `multipart/form-data`，字段 `file` → `IconUploadResult`（`title/sourceUrl` 为 null）。

### 3.5 同步缺失图标

`POST /nav/icons/sync` → `{ "total": 18, "success": 15, "failed": 3 }`

---

## 4. 书签新增 / 更新契约

`POST /nav/bookmarks`：

```json
{ "categoryId": 3, "title": "GitHub", "url": "https://github.com",
  "iconType": "auto", "iconKey": "icons/…", "iconText": null, "iconColor": null }
```

`PUT /nav/bookmarks/{id}`：同上，`categoryId` 可选。

规则：

| `iconType` | 必填 | 落库行为 |
|---|---|---|
| `auto` | - | `iconKey` 有值则写入并记录 `icon_synced_at`；URL 变化且未传 key 时清空旧 key，触发重新同步；清空文字 / 颜色 |
| `upload` | `iconKey` | 校验 `icons/` 前缀 + 对象存在；清空文字 / 颜色 |
| `text` | `iconText` | 1~3 字符；`iconColor` 缺省 `#3B82F6`；清空 `icon_key` |
| 未传 | - | 保持原图标不变（只改标题 / URL 时不误删图标） |

`iconKey/iconText/iconColor/iconSyncedAt` 在实体上标注 `updateStrategy = ALWAYS`，保证清空字段能真正写 NULL。

---

## 5. 前端缓存与渲染

### 5.1 `utils/iconCache.ts`

- localStorage key `veythcog:nav-icons:v1`，结构 `{ [bookmarkId]: { sig, icon, ts } }`；
- 签名 = `iconType|iconKey|iconText|iconColor|iconSyncedAt|hasIcon`，签名变化即视为未命中并删除；
- TTL 30 天；最多保留 300 条，超出按 `ts` 最旧淘汰；
- 提供 `getCachedIcon(bookmark)` / `setCachedIcon(bookmark, icon)` / `clearCachedIcon(id)`。

### 5.2 `BookmarkIcon` 渲染顺序

```
1. 同步读 localStorage 缓存 → 命中直接渲染（首屏无请求、无闪烁）
2. 未命中：
   a. iconType=text → 用列表里的 iconText/iconColor 本地渲染并写缓存
   b. hasIcon=false → 文字占位，不发请求
   c. 请求 GET /nav/bookmarks/{id}/icon → 写缓存 → 渲染（失败保持文字占位）
```

- 图片 `<img>` 加载失败 → 文字占位；
- 文字图标底色用 `iconColor`，文字颜色按底色亮度取黑 / 白，保证可读。

### 5.3 `BookmarkModal`（参照截图）

结构：

```
自定义图标 / 自定义桌面图标内容
┌ 卡片 1 ─────────────────────────────┐
│ 网址   [ 🔗 https://…        [获取图标] ] │
│ 名称   [ T 网站名称                    ] │
└──────────────────────────────────────┘
┌ 卡片 2 ─────────────────────────────┐
│ [文字图标预览]  [上传 +]  [网站图标预览]   │
│   文字图标       上传       网站图标        │
│ 图标文字 [ Tt  A ]                       │
│ 图标颜色 ●●●●●●●●●●●● ◯自定义            │
└──────────────────────────────────────┘
[保存] [保存并继续]
```

- 模式三选一：`text` / `upload` / `fetched`（网站图标）；
- 「获取图标」：URL 为空 / 非 http(s) 提示；成功后显示第三个图标位并选中，名称空时用站点标题回填（截 64 字）；
- 「上传」：文件选择后立即上传 S3 并预览；超 512KB 或非白名单格式前端先拦一次；
- 文字图标：输入框 maxLength 3，默认取名称首字符；12 个预设色 + 原生取色器；
- 编辑：打开时按 `iconType` 选中对应位；`upload` / `auto` 通过图标接口取现有图片预览；保存未换图标时回传原 `iconKey`；
- 保存：新建走 `POST`，编辑走 `PUT`；成功后清该 id 的本地缓存并静默刷新当前分类书签；「保存并继续」保存后复位为新建态，弹窗不关闭。
- 取消上传产生的 S3 对象为孤儿（个人应用可接受），不做删除回调。

---

## 6. 边界与降级

| 场景 | 降级 |
|---|---|
| 站点无 favicon / 被风控 | 同步失败只记录日志，书签保持文字占位；1 天后重试 |
| S3 上传失败 | 接口返回「图标上传失败」，弹窗保持已选模式，用户可改用文字图标 |
| `storage.s3.enabled=false` | 沿用现有约束：壁纸服务已强依赖 S3，本功能同样不装配 |
| 生产 HTTPS 页面加载 HTTP S3 直链 | 部署要求：`storage.s3.public-endpoint` 必须配置为 HTTPS 域名，否则浏览器按 mixed content 拦截 |
| `icon_key` 指向的对象被删 | 图标接口返回 `url=null`，前端文字占位；下次同步不会自动补（icon_key 非空），需要重新「获取图标」 |

---

## 7. 验证记录（2026-11-12）

环境：本机后端 8124 临时实例（`--nav.icon.sync-on-startup=false`）、PostgreSQL 15、RustFS `111.230.146.233:9000`。

### 7.1 接口结果

- `GET /nav/bookmarks?categoryId=1` → `code=0`，含 `iconType/iconKey/iconText/iconColor/hasIcon`；
- `GET /nav/bookmarks/3/icon` → `{type:"auto", url:"http://…/public-icons/icons/…png"}`；
- `POST /nav/icons/fetch`（知乎）→ 成功，回填 `title` / `sourceUrl`，S3 直链 200 + `image/png`；
- `POST /nav/icons/upload`（1×1 PNG，客户端报 `application/octet-stream`）→ 成功；
- 新建文字图标 → 改上传图标 → `GET /icon` 返回 S3 直链 → 删除，全链路通过；
- `POST /nav/icons/fetch` 传 `http://127.0.0.1:8124/...` → `40000 不允许访问本机或内网地址`（SSRF 防护生效）。

### 7.2 同步结果

首次启动同步 18 条：**12 成功 / 6 失败**。补上站点 `Referer` 后重试，SegmentFault 成功，最终 **13/18** 已落到 `public-icons`。

剩余 5 条为环境 / 站点原因：

| 站点 | 原因 | 处理 |
|---|---|---|
| github.com | `/favicon.ico` 超时（当前网络不可达） | 1 天后重试；前端文字兜底 |
| baomidou.com | 仅声明 `favicon.svg`，按安全策略拒绝 SVG | 用户可上传 / 文字图标 |
| stackoverflow.com | Cloudflare 403 | 同上 |
| translate.google.com | 超时 | 同上 |
| veythcog.top | DNS 无 A/AAAA 记录 | 域名侧恢复后自动重试 |

### 7.3 本轮补充的两个兼容点

1. **multipart 声明类型不可信**：浏览器可能把图片报成 `application/octet-stream`。上传接口对该类型不做白名单校验，改为只认文件头魔数；同时显式拒绝魔数为空的 SVG。
2. **图标 CDN 防盗链**：抓取候选图标时带上站点 `Referer`，SegmentFault 这类 CDN 才能返回图标。

### 7.4 未完成的验证

- localStorage 图标缓存「首次请求 → 二次命中」只在代码层实现（签名 + 30 天 TTL + 300 条上限），未做浏览器实测；
- 前端弹窗视觉未在真实浏览器截图比对（`npm run build` 已通过）。
