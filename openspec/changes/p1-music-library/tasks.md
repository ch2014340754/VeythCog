# Tasks · P1 音乐库与网站背景音

> 关联：`proposal.md`、`design.md`、`openspec/music-prd.md`
> 勾选即代表"已完成并自测通过"

## A. 基础设施

- [ ] A1 `vc-common/S3Bucket` 增加 `MUSIC("music", false, ...)`
- [ ] A2 运维在 RustFS 创建私有桶 `music`（本地 docker-compose 与线上各一次）
- [ ] A3 `vc-app/application.yml` 增加 multipart 25MB / 30MB
- [ ] A4 `.env.example` 增加 `music.stream.secret` / `music.stream.token-ttl` / `music.ambient.max-tracks`
- [ ] A5 `docs/sql/022_music.sql`（建表 + 3 个索引；执行前确认当前库最大编号）
- [ ] A6 根 `pom.xml` `<modules>` + `vc-app/pom.xml` 依赖加入 `vc-music`

## B. 后端 vc-music

- [ ] B1 `entity/MusicTrack`（MyBatis-Plus `@TableName("music_track")`，`deleted` 逻辑删除）
- [ ] B2 `mapper/MusicTrackMapper`（分页查询带 owner/关键字/来源/背景音筛选）
- [ ] B3 `MusicStreamTokenService`：签发 + 校验（HMAC-SHA256，绑定 trackId/ownerId，TTL 5 分钟）
- [ ] B4 `MusicTrackService`：列表、详情、上传落库（S3 + DB 补偿）、更新、软删 + 删对象、背景音入池/出池/排序/上限 8
- [ ] B5 `MusicStreamService`：HEAD + Range 解析 + 206/200 输出（参照 `NavWallpaperService#video`）
- [ ] B6 `MusicController`：8 个接口（tracks / track detail / upload / update / ambient toggle / delete / ambient list / stream）
- [ ] B7 校验：后缀仅 mp3/m4a、`content-type` 二次校验、≤20MB、时长 ≤600s、`license` 枚举禁 `CC-BY-NC`、`CC-BY` 必填 `attribution`、AI 勾选必填 `ai_model`
- [ ] B8 归属：所有 Service 入口取当前 userId，Mapper 条件强制 `owner_id`；跨账号 → 40400
- [ ] B9 单测：Range 解析（合法/越界/多段/后缀）、token 过期与篡改、许可枚举、跨账号

## C. 前端

- [ ] C1 `src/api/music.ts`（listTracks / getTrack / uploadTrack 用 `uploadFile` / updateTrack / toggleAmbient / removeTrack / listAmbient）
- [ ] C2 `musicStore` 扩展 `ambientOn` / `ambientVolume` / `currentTrackId`（前两项 persist）
- [ ] C3 `FloatingMusicPlayer` 接真实列表（保留 mock 兜底）；切歌只换 `src` 不重建 audio
- [ ] C4 播放器控制行加背景音按钮（`vc-player__icon-btn` + `is-on`）
- [ ] C5 背景音行为：0.25 音量、3s 渐入 / 1.5s 渐出、`visibilitychange` 暂停恢复、手动选曲自动退出、触屏默认不进
- [ ] C6 `src/pages/MusicLibrary.tsx`（Table + 上传 Modal + 编辑 Modal + 二次确认删除），`vc-music__*` + `glass-panel`
- [ ] C7 `App.tsx` 注册 `/music` 懒加载路由（受保护页面内）
- [ ] C8 无感规范：细进度条、筛选保留旧数据、编辑不打断播放、失败只 toast
- [ ] C9 `audio.error` 捕获 → 静默换 token → 从 `currentTime` 续播

## D. 验收（对应 PRD §10 十二条）

- [ ] D1 上传 / 播放 / 元信息正确
- [ ] D2 非法后缀、21MB、13 分钟、`CC-BY-NC` 全部 40000
- [ ] D3 拖进度条 206 且 `Content-Range` 正确
- [ ] D4 未登录 401；跨账号 40400
- [ ] D5 token 过期静默续播
- [ ] D6 背景音 0.25 + 渐入 + 切页不断流 + 后台暂停
- [ ] D7 背景音与手动选曲不叠加
- [ ] D8 重开页面记住背景音偏好，但仍需手势
- [ ] D9 编辑非当前曲目播放不中断、列表原位更新
- [ ] D10 删除当前播放曲目自动跳下一首
- [ ] D11 背景音池第 9 首被拒
- [ ] D12 筛选"AI 生成"只出 `ai_disclosure=true` 且卡片带标识

## E. 收尾

- [ ] E1 更新 `VeythCog-V/docs/TODO.md` 音乐一行状态（⬜ → ✅）
- [ ] E2 更新 `openspec/music-prd.md` 变更记录（v0.2 已确认决策落地情况）
- [ ] E3 停掉本次启动的本地服务进程（后端 / 前端 dev server）
