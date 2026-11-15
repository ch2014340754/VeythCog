# Proposal · P1 音乐库与网站背景音

> 版本：v0.1（2026-11-15）
> 状态：待 review（PRD 已定稿 `openspec/music-prd.md` v0.2）
> 关联：`openspec/music-prd.md`

## 为什么做（Why）

`FloatingMusicPlayer` 已完整落地（毛玻璃、拖动、弹层、真 `<audio>`），但数据仍是 `src/mock/music.ts` 里的 SoundHelix 示例音频，`GET /api/music/tracks` 与 `/api/music/stream/:id` 在后端完全空缺。同时用户明确需要**网站背景音**：用本地 AI（ACE-Step 1.5）自产曲目 + 少量 CC 曲库，入库到 S3，作为登录用户访问站点时的低干扰氛围音。

现状问题：
1. 播放器是"空壳"——有交互没有数据，无法作为交付物演示；
2. 没有曲库管理入口，AI 生成的几十首音频无处登记、无许可字段，后续扩源（Jamendo / CC 曲库）没有结构承接；
3. 想加背景音时最自然的新建一个播放器组件，会直接导致全站两个 `<audio>` 实例同时出声。

## 做什么（What）

新建后端模块 `vc-music` + 前端 `/music` 页面，并把现有播放器接上真实数据，新增"背景音模式"。

1. **曲库（账号绑定）**：`music_track` 表带 `owner_id`，上传 / 编辑 / 启停 / 删除 / 分页查询，全部以当前登录用户为作用域。
2. **对象存储**：新增私有桶 `music`，`vc-common/S3Bucket` 增加枚举；上传直传 S3，不落本地磁盘。
3. **播流**：`GET /api/music/stream/{id}?token=`，**后端 Range 代理返回 206**，不走预签名直链（预签名在 Range 请求上会被对象存储重置连接，`NavWallpaperService.video()` 已验证）。
4. **背景音模式**：不是新组件，是播放器的一个模式——单 `audio` 实例复用、音量 0.25、3 秒渐入、默认关闭、偏好持久化、页面隐藏即暂停、必须等用户手势。
5. **合规字段**：`source / license / attribution / ai_disclosure / ai_model` 入库即落，`CC-BY-NC` 在枚举层就不存在。

## 范围（Scope）

### In-scope（P0）

- 后端 `vc-music`：entity / mapper / service / controller / dto；`022_music.sql`
- `vc-common`：`S3Bucket.MUSIC` 枚举
- 前端：`src/api/music.ts`、`musicStore` 扩展、`FloatingMusicPlayer` 改造、`src/pages/MusicLibrary.tsx`、`App.tsx` 注册路由
- 播流 token：短时签名（5 分钟，绑定 trackId），query 传递

### Out-of-scope（P0 不做）

- ❌ 自定义多歌单、收藏、播放历史/播放次数
- ❌ 封面图片上传与缩略图（P0 用双色渐变 `cover_color`）
- ❌ 服务端转码与波形图
- ❌ 外部源同步任务（Jamendo 拉取）、manifest 批量导入
- ❌ 访客模式（未登录不可听，含背景音）

## 影响面

| 区域 | 影响 |
|---|---|
| 后端依赖 | 新增 `vc-music` 模块，需改根 `pom.xml` `<modules>` 与 `vc-app/pom.xml` |
| 数据库 | 新增 `music_track` 表（022 脚本），无既有表变更 |
| S3 | 新增私有桶 `music`，需运维创建 |
| 前端 | 播放器数据源从 mock 换 API；`/music` 新路由；`musicStore` 增背景音状态 |
| 已有功能 | 不触达导航、知识库、对话；播放器视觉与拖动逻辑不变 |

## 风险

1. 自动播放被浏览器拦截 → 静默失败，不报错
2. token 过期导致中途 403 → 前端捕获 `audio.error`，静默换 token 并从 `currentTime` 续播
3. 轻量服务器带宽 → 背景音池 ≤8 首 + mp3 128~192kbps + 页面隐藏即停
4. Range 代理实现偏差 → 严格参照 `NavWallpaperService.video()` 的 `parseRange` 兜底逻辑（非法 Range 回退整段，绝不 416）

## 验收（摘要）

- 上传 3MB mp3 → 列表可见、可播；跨账号访问他人曲目 → 40400
- 拖进度条 → 206 + `Content-Range` 正确
- 背景音开启：音量 0.25、渐入、切页不断流、后台暂停、手动选曲自动退出背景音
- 曲库变更后列表原位刷新（2px 细进度条），播放不中断
