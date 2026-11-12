# Tasks · P2 导航书签自定义图标

> 版本：v1.0（2026-11-12）
> 执行顺序：SQL → 后端 → 前端 → 联调 → 文档。

## 阶段 1：数据库

- [x] 1.1 新增 `docs/sql/013_nav_bookmark_icon.sql`（5 列 + `icon_type` 约束，幂等）
- [x] 1.2 `012_nav.sql` 新建表同步包含图标列
- [x] 1.3 在本地库执行 013，`information_schema.columns` 复核

## 阶段 2：后端

- [x] 2.1 `NavBookmark` 实体补 `iconType/iconKey/iconText/iconColor/iconSyncedAt`（`updateStrategy=ALWAYS`）
- [x] 2.2 新增 `BookmarkView` / `NavIconView` / `IconUploadResult` / `IconSyncResult` / `IconFetchRequest`
- [x] 2.3 新增 `SiteIconFetcher`：SSRF 防护、HTML link 解析、魔数校验、6s/512KB 上限
- [x] 2.4 新增 `NavIconService`：抓取上传、自定义上传、解析缓存、缺失同步、evict
- [x] 2.5 `NavBookmarkService`：列表返回 `BookmarkView`；新增/更新图标字段校验与落库；自动图标异步同步
- [x] 2.6 `NavBookmarkController` 增加 `GET /nav/bookmarks/{id}/icon`
- [x] 2.7 新增 `NavIconController`：`POST /nav/icons/fetch|upload|sync`
- [x] 2.8 新增 `NavIconStartupSync` + `application.yml` 的 `nav.icon.sync-on-startup`

## 阶段 3：前端

- [x] 3.1 `api/client.ts` 抽公共响应解析 + `uploadFile`（multipart，不手写 Content-Type）
- [x] 3.2 `api/nav.ts` 补图标类型字段 / 图标接口 / 同步接口
- [x] 3.3 新增 `utils/iconCache.ts`（签名失效 + TTL + 容量上限）
- [x] 3.4 `BookmarkIcon.tsx` 改为缓存优先 + `/icon` 接口兜底；文字图标本地渲染
- [x] 3.5 `BookmarkModal.tsx` 按截图重做（获取图标 / 上传 / 文字 + 颜色 / 保存并继续）
- [x] 3.6 `Home/index.tsx` 发现未同步自动图标时后台触发一次 `syncIcons`

## 阶段 4：验证

- [x] 4.1 后端 `mvn -pl vc-app -am -DskipTests compile` 通过
- [x] 4.2 前端 `npm run build` 通过（`tsc && vite build`，1m43s）
- [x] 4.3 启动后端，登录后验证：获取图标、上传图标、同步、`GET /icon`
- [x] 4.4 验证 `public-icons` 公开直链可直接在浏览器打开
- [ ] 4.5 验证缓存：首次请求 `/icon`，二次进入不再请求（已实现签名 + TTL，未做浏览器实测）
- [x] 4.6 停止本次启动的后端进程（验证实例 8124 已停止，未保留）

### 验证结果（2026-11-12）

| 项 | 结果 |
|---|---|
| `GET /nav/bookmarks?categoryId=1` | `code=0`，返回 `iconType/iconKey/iconText/iconColor/hasIcon` |
| `GET /nav/bookmarks/3/icon` | `{type:"auto", url:"http://111.230.146.233:9000/public-icons/icons/...png"}` |
| `POST /nav/icons/fetch`（知乎） | 成功，回填 `title` + `sourceUrl`，`iconUrl` 直链 200 / `image/png` |
| `POST /nav/icons/upload`（1×1 PNG） | 成功；`application/octet-stream` 也能通过（按魔数识别） |
| 新建文字图标 → 改上传图标 | 文字图标返回 `text/color`；切上传后 `GET /icon` 返回 S3 直链；删除成功 |
| `POST /nav/icons/sync` | 首次 18 条 → 12 成功 / 6 失败；补 Referer 后重试 SegmentFault 成功，累计 13/18 |
| SSRF 防护 | `POST /nav/icons/fetch` 传 `http://127.0.0.1:8124/...` → `40000 不允许访问本机或内网地址` |

未同步成功的 5 条（均为环境 / 站点侧原因，非抓取逻辑缺陷）：

- `github.com`：`/favicon.ico` 8s 超时（当前网络不可达）；
- `baomidou.com`：站点只声明 `favicon.svg`，按安全策略拒绝 SVG；
- `stackoverflow.com`：403（Cloudflare 反爬）；
- `translate.google.com`：8s 超时；
- `veythcog.top`：DNS 无 A/AAAA 记录（`Resolve-DnsName` 仅返回 SOA）。

这些书签 `icon_key` 仍为空，`icon_synced_at` 已写入，按设计 1 天后自动重试；前端此时用书名前 3 字兜底，用户也可在弹窗改用上传 / 文字图标。

## 阶段 5：文档

- [x] 5.1 `PROJECT_MEMORY.md`：§3 模块、§5 表结构、§6 接口、§7 前端、§8 配置、§10 状态
- [x] 5.2 `.ai-context/change-log.md` 追加本次变更；`current-tasks.md` 补 NAV-01~05
