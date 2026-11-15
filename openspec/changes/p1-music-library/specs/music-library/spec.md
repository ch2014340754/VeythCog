# 规格：音乐库与网站背景音（P1）

> 关联 PRD：`openspec/music-prd.md` v0.2
> 作用域：全部能力以当前登录用户为作用域（`owner_id`），跨账号一律 40400

## 能力 1：曲库分页查询

- `GET /api/music/tracks`，参数 `current` / `pageSize` / `keyword` / `source` / `ambientOnly` / `tag`。
- 只返回当前用户的、`deleted=false` 的曲目；默认按 `created_at desc`。
- 每项字段：`id / title / artist / durationMs / coverColor[string,string] / source / license / attribution / licenseUrl / aiDisclosure / aiModel / tags / ambientEnabled / ambientOrder / status / streamUrl / createdAt`。
- `streamUrl` 为短时签名地址（`/api/music/stream/{id}?token=...`，TTL 5 分钟）。
- `keyword` 匹配 `title` 或 `artist`（PG `simple` GIN 索引）。

## 能力 2：上传入库

- `POST /api/music/upload`（multipart：`file` + 元信息字段）。
- 后缀白名单**仅** `.mp3` / `.m4a`；`content-type` 必须为 `audio/mpeg` 或 `audio/mp4`，与后缀不一致 → 40000。
- 大小 ≤ 20MB；`durationMs` ≤ 600000。
- `license ∈ {CC0, CC-BY, OWNED, AI_GEN, LICENSED}`；传 `CC-BY-NC` 或其它值 → 40000「许可类型不支持」。
- `license = CC-BY` 时 `attribution` 不能为空。
- `aiDisclosure = true` 时 `aiModel` 不能为空。
- 顺序：先传 S3（key 为 `music/{ownerId}/{yyyy}/{uuid}.{ext}`）→ 再落库；落库异常则删除已上传对象后抛出。
- 返回新建项的详情（含 `streamUrl`）。

## 能力 3：元信息更新

- `PUT /api/music/tracks/{id}`，body 同上传的元信息部分。
- 不存在或不属于当前用户 → 40400。
- 许可校验同能力 2（含禁 `CC-BY-NC`）。
- 不改变 `object_key` 与音频内容；更新后 `updated_at` 刷新。

## 能力 4：启用/停用背景音

- `PUT /api/music/tracks/{id}/ambient`，body `{enabled, order?}`。
- 启用时若当前池已达 `music.ambient.max-tracks`（默认 8）→ 40000「背景音池已达上限（8 首）」。
- `order` 缺省取 `max(order)+1`；重复启用幂等（不重复占位）。
- 停用仅置 `ambient_enabled=false`，不清 `ambient_order`（便于恢复原位）。

## 能力 5：背景音池

- `GET /api/music/ambient`。
- 只返回当前用户、`ambient_enabled=true`、`status=published`、`deleted=false` 的曲目，按 `ambient_order asc`。
- 每项含 `streamUrl`；空池返回 `[]`（前端静默不播放，不报错）。

## 能力 6：删除

- `DELETE /api/music/tracks/{id}`。
- 软删 DB（`deleted=true`）→ 删 S3 对象（幂等，失败仅 WARN）。
- 已删除或不属于当前用户 → 40400。
- 若删除的是背景音池内曲目，从池中移除（同一事务内）。

## 能力 7：音频播流（Range 代理）

- `GET /api/music/stream/{id}?token=<sign>`。
- token 无效/过期 → 40100；trackId 与 token 内 trackId 不一致 → 40100。
- 归属校验：token 内 ownerId 必须等于曲目 `owner_id`，否则 40400。
- 无 Range：200 + 全量流 + `Accept-Ranges: bytes`。
- 有 Range：206 + `Content-Range: bytes start-end/total`；非法/越界 Range **回退整段**，绝不返回 416。
- `Content-Type`：mp3 → `audio/mpeg`，m4a → `audio/mp4`；对象元数据缺失时按后缀兜底。
- 响应体流式写出，禁止整段读入内存。

## 能力 8：播放器接真实数据 + 背景音模式

- 播放列表来源为能力 1 的前 200 首；接口失败回落到 `mock/music.ts` 并 toast 提示一次。
- **全站唯一 `<audio>` 实例**：切歌只替换 `src`，不重建元素，保留音量与静音态。
- 背景音：默认关闭；开启后音量 0.25、3 秒渐入；关闭时 1.5 秒渐出再暂停。
- 必须等首次用户手势才允许出声；被拦截时静默失败。
- `document.visibilityState === 'hidden'` 暂停，恢复可见后继续。
- 用户在播放器内主动选曲 → 自动退出背景音模式。
- 触屏设备默认不启用背景音，需手动开启。
- 偏好（`ambientOn` / `ambientVolume`）持久化到 localStorage。

## 能力 9：页面与无感

- `/music` 仅登录可访问；未登录 401 跳登录（沿用 `client.ts` 现有 401 逻辑）。
- 曲库页：Table + 上传 Modal + 编辑 Modal + 删除二次确认；类名 `vc-music__*`，容器 `glass-panel`，颜色仅用 `--color-*` / `--glass-*`。
- 变更后**静默刷新**：不整页 loading、不重建播放器；刷新期间顶部 2px 细进度条。
- 筛选切换保留旧列表直到新数据返回。
- 编辑非当前曲目时播放不中断；接口失败只 toast。

## 验收标准

1. 上传 3MB mp3 成功，列表可见可播，元信息与入参一致
2. `.wav` / `.flac` / 21MB / 13 分钟 / `CC-BY-NC` 全部 40000
3. 拖动进度条返回 206 且 `Content-Range` 正确，播放不中断
4. 未登录任意接口 401；A 账号访问 B 账号曲目 40400
5. token 过期后前端静默换 token，从原进度续播
6. 背景音开启音量 0.25 + 渐入；切页不断流；后台暂停；手动选曲自动退出
7. 重开页面背景音偏好保留，但仍需手势才出声
8. 删除当前播放曲目自动跳下一首，无空 src 报错
9. 背景音池第 9 首被拒并提示上限
10. 筛选"AI 生成"仅返回 `aiDisclosure=true`，卡片展示 AI 标识
