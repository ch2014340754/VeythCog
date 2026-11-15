# VeythCog 音乐管理模块 PRD

> 文档路径：`openspec/music-prd.md`
> 需求名：音乐库 + 网站背景音（P0）
> 技术栈：React 18 + TS + Vite + AntD 5 + Zustand + Iconify / Spring Boot 3.5 + Java 21 + MyBatis-Plus + PostgreSQL 16 + RustFS(S3)
> 模块：新建 `vc-music`（后端）+ `/music`（前端）
> 版本：v0.1-P0（待评审）
> 复杂度：中
> 依赖：`openspec/api-spec.md`、`vc-common/s3`（`S3Bucket` / `S3StorageClient` / `S3PresignService`）、`vc-nav` 的 Range 代理先例、`VeythCog-V/docs/AI音乐生成-M2本地教程.md`

## 变更记录表

| 版本 | 变更点 |
|---|---|
| v0.1 | 初版：曲库 CRUD + 上传 + 背景音模式 + 许可/AI 标识字段；复用现有全局播放器实例，不新建组件 |
| v0.2 | ✏️ 路由定为 `/music` 且**曲库与账号绑定**（新增 `owner_id`，按当前用户隔离，不做全站共享）；✏️ 入库格式收紧为**仅 mp3/m4a**；🆕 **`CC-BY-NC` 入库即拦截**（选项里不提供，接口二次校验）；🔒 未登录不可听背景音（维持）；✔️ 音量 0.25、背景音池上限 8 首定为默认值 |

## 1. 概述

### 1.1 背景

前端 `FloatingMusicPlayer` 已完整落地：毛玻璃卡片、右边缘竖条把手拖动/固定、播放列表按位置上下弹出、真 `<audio>` 播放。**但数据仍是 `src/mock/music.ts` 里的 SoundHelix 示例音频**，后端 `GET /api/music/tracks`、`GET /api/music/stream/:id` 完全空缺（见 `VeythCog-V/docs/TODO.md`）。

同时业务上多了一个明确诉求：**网站背景音**。用户会用本地 AI（ACE-Step 1.5）自产曲目、少量 CC 曲库补充，最终全部入库到 S3，作为访客访问站点时的低干扰背景氛围音。

因此本模块不是"做一个播放器"（播放器已经有了），而是**补齐曲库数据链路 + 复用播放器做背景音模式**。

### 1.2 目标

1. P0 交付最小可用音乐库：上传、元信息编辑、列表、启停、删除、播放
2. 音频对象存 S3 私有桶 `music`，播流走后端 Range 代理（206），不用预签名直链
3. 增加"背景音模式"：低音量、渐入、默认关闭、可记忆，且**与悬浮播放器共用同一个 audio 实例**
4. 曲目必须携带来源与许可字段（`source` / `license` / `attribution` / `ai_disclosure`），为后续扩源（Jamendo、CC 曲库、AI 生成）留出结构
5. 前端严格复用现有视觉与交互规范，不引入第二套播放器视觉

### 1.3 范围

✅ P0 包含：曲库表格/卡片页、拖拽上传（含元信息填写）、元信息编辑、启用/停用、删除、背景音池配置、`GET /api/music/tracks` 列表、`GET /api/music/stream/{id}` 代理播流、播放器接真实数据、背景音开关与偏好记忆。

⏳ P1 预留（只定义位点，不实现）：自定义歌单（多播放列表）、收藏/喜欢、播放历史与播放次数统计、封面图片上传与缩略图、批量导入（manifest 批量入库）、外部源同步任务（Jamendo 拉取）。

🔴 不在范围：多人协同编辑、评论互动、音频波形可视化、歌词同步（LRC）、音频在线剪辑、DRM。

### 1.4 约束

1. 格式：**仅 `mp3` / `m4a`**（已在评审确认）；单文件 ≤ **20MB**，时长 ≤ 10 分钟；P0 不做服务端转码（按原样入库）
2. 存储：S3 私有桶 `music`，全部走后端代理，不暴露公开直链
3. 带宽：轻量服务器经不起大流量回源，单曲建议 mp3 128~192kbps；背景音池 P0 限制 3~8 首
4. 权限：**登录即可访问，但数据按账号隔离**——`music_track.owner_id` 记录归属，所有查询与写操作都以当前登录用户为作用域；不做全站共享（与知识库的"账号共享"策略不同）
5. 浏览器策略：**自动播放必须等首次用户手势**，P0 不允许任何"打开页面直接出声"的实现
6. 数量：P0 单账号曲库上限按 300 首设计（列表分页，不做全量返回）
7. 许可：**`CC-BY-NC` 一律不接受**，入库时直接拒绝；许可枚举仅 `CC0 / CC-BY / OWNED / AI_GEN / LICENSED`

## 2. 角色与权限

| 角色 | 权限 | 说明 |
|---|---|---|
| 未登录 | 全部 `/api/music/**` 返回 401 | 无匿名只读分支；**未登录也不能听背景音** |
| 登录用户 | 读写**自己账号下**的曲库 | 按 `owner_id` 隔离：列表、详情、编辑、删除、背景音池均限定当前用户 |

> **与知识库的差异（v0.2 决策）**：知识库是"账号间共享"，音乐库是"**账号绑定**"。因此本模块**必须**校验归属——所有 Service 入口先取当前登录用户 id，Mapper 查询条件强制带 `owner_id`，跨账号访问一律 40400（不暴露存在性）。
>
> 落地方式：`SecurityConfig` 保持 `anyRequest().authenticated()`；用户 id 从现有登录上下文取（与 `vc-nav` 的 `userId` 获取方式一致）。

## 3. 页面 & 路由设计

| 路由 | 页面 | 说明 |
|---|---|---|
| `/music` | 音乐库管理页 | 曲库列表、上传、元信息编辑、背景音池配置 |
| 全局浮层（非路由） | 悬浮播放器（已存在） | 改造为接真实数据 + 背景音开关 |
| 首页工具条入口 | 播放器展开入口 | 复用现有 `musicStore.open()` |

### 3.1 音乐库管理页（`/music`）

- 顶部：面包屑、搜索框（标题/艺人关键词）、筛选（来源 `source`、是否启用背景音、AI 生成）、【上传音频】
- 视图：**列表优先**（P0 用表格，字段密集；卡片视图 P1）
- 列表列：序号/拖拽柄（P1）、封面（渐变或图片）、标题、艺人、时长、来源、许可、AI 标识、背景音开关、操作（播放/编辑/删除）
- 批量：复选框占位（P1 批量删除/批量入池）
- 底部：曲目总数、背景音池当前数量（如 `背景音 5/8`）

### 3.2 上传弹窗

- 拖拽或点选文件，自动读取时长（前端用临时 `<audio>` 读 `metadata`，避免后端引新依赖）
- 表单元信息：标题（默认取文件名）、艺人、来源 `source`、许可 `license`（下拉仅 `CC0 / CC-BY / OWNED / AI_GEN / LICENSED`，**不出现 CC-BY-NC**）、署名 `attribution`（选 `CC-BY` 时必填）、许可链接 `license_url`、标签、是否 AI 生成（勾选后展开 `ai_model`）
- 校验：后缀白名单 **仅 `.mp3` / `.m4a`**（前端先拦，后端按 `content-type` + 后缀双校验）、≤20MB、时长 ≤600s；勾选 AI 生成时 `ai_model` 必填
- 提交：`POST /api/music/upload`（multipart，一次完成"对象上传 + 落库"）

### 3.3 悬浮播放器改造（不改视觉）

保持现有 `vc-player__*` 类名、`--glass-*` 变量、340/20/150 三个常量、拖动与自动收起逻辑**一行不动**，只替换数据源与新增两个能力：

1. 播放列表来自 `GET /api/music/tracks`（分页取前 200 首，登录后拉一次、静默刷新）
2. 播放器底部控制行右侧新增"背景音"图标按钮（`volume-1` 类图标），点击进入/退出背景音模式

> **关键约束：全站只能有一个 `<audio>` 实例。** 背景音不是新组件，是悬浮播放器的一个模式；否则两个音轨会同时出声。

## 4. 背景音模式设计

### 4.1 行为定义

| 项 | 规则 |
|---|---|
| 启动时机 | 必须在**首次用户手势**之后（点击/键盘/滚动任一），否则静默失败不报错 |
| 默认状态 | **默认关闭**，用户主动开启后写入偏好（`localStorage: music:ambient`） |
| 曲目来源 | 背景音池（`ambient_enabled = true` 且 `status = published` 的曲目），随机起始 + 顺序循环 |
| 音量 | 默认 **0.25**，独立于普通播放音量；开启时 3 秒线性渐入，关闭时 1.5 秒渐出再暂停 |
| 页面隐藏 | `document.visibilityState === 'hidden'` 时暂停，恢复可见后继续（省流量也符合直觉） |
| 切页 | 全局实例，路由切换不断流（现有 `App.tsx` 单实例已满足） |
| 移动端 | 触屏设备默认不进背景音（流量与体验权衡），需手动开启 |
| 与手动播放的关系 | 用户在播放器里主动选曲 → 自动退出背景音模式，避免音量叠加混乱 |

### 4.2 UI 表现

- 背景音开启时，播放器卡片收起态只露把手，**不占视觉**；悬停展开可见一枚小标识"背景音"
- 关闭播放器 / 退出背景音 → 立即暂停并停止预加载
- 不做"背景音专属界面"，避免和现有播放器产生两套视觉

### 4.3 音频元素复用

现有 `audioRef` 单实例沿用，背景音只是**改变 src 与音量、接管切换逻辑**，不新建 `Audio()`。

## 5. 数据模型设计（PG）

> 建表脚本：`VeythCog-C/docs/sql/022_music.sql`（`ddl-auto=none`，表由脚本管理，跟随现有编号规则）

```sql
CREATE TABLE music_track (
    id              BIGSERIAL PRIMARY KEY,
    owner_id        BIGINT       NOT NULL REFERENCES app_user(id),  -- 🆕 v0.2 账号绑定
    title           VARCHAR(200) NOT NULL,
    artist          VARCHAR(200) NOT NULL DEFAULT '',
    duration_ms     INTEGER      NOT NULL DEFAULT 0,
    object_key      VARCHAR(500) NOT NULL,              -- S3 music 桶内 key
    cover_key       VARCHAR(500),                       -- 可选：封面对象 key（P1 使用）
    cover_color     JSONB        NOT NULL DEFAULT '[]'::jsonb, -- 双色渐变 ["#7C3AED","#06B6D4"]
    source          VARCHAR(20)  NOT NULL DEFAULT 'UPLOAD',    -- UPLOAD/AI_GEN/JAMENDO/AIGEI_CC/AI_OTHER
    license         VARCHAR(20)  NOT NULL DEFAULT 'OWNED',     -- CC0/CC-BY/OWNED/AI_GEN/LICENSED（禁 CC-BY-NC）
    attribution     VARCHAR(500) NOT NULL DEFAULT '',          -- 署名文案（CC-BY 必填）
    license_url     VARCHAR(500) NOT NULL DEFAULT '',
    ai_disclosure   BOOLEAN      NOT NULL DEFAULT false,       -- AI 生成标识（显式+隐式）
    ai_model        VARCHAR(100) NOT NULL DEFAULT '',          -- 如 acestep-v15-turbo
    tags            TEXT[]       NOT NULL DEFAULT '{}',
    ambient_enabled BOOLEAN      NOT NULL DEFAULT false,       -- 是否进背景音池
    ambient_order   INTEGER      NOT NULL DEFAULT 0,
    status          VARCHAR(16)  NOT NULL DEFAULT 'published', -- published/hidden
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    deleted         BOOLEAN      NOT NULL DEFAULT false
);

CREATE INDEX idx_music_track_owner     ON music_track(owner_id, deleted);
CREATE INDEX idx_music_track_ambient   ON music_track(owner_id, ambient_enabled, ambient_order) WHERE deleted = false;
CREATE INDEX idx_music_track_title_gin ON music_track USING gin(to_tsvector('simple', title || ' ' || artist));
```

### 5.1 字段设计要点

| 设计 | 原因 |
|---|---|
| `owner_id` 必填 | v0.2 定为账号绑定；缺省值不设，防止"忘了赋值"变成公共数据 |
| `object_key` 而非 `url` | URL 会随 endpoint / 签名策略变化，只存 key；播放地址由接口按需生成 |
| `license` + `attribution` 必填位 | CC-BY 必须展示作者；`CC-BY-NC` 不进入枚举，入库即被拒 |
| `ai_disclosure` + `ai_model` | 满足《人工智能生成合成内容标识办法》的标识义务，前端卡片需展示"AI 生成" |
| `cover_color` JSONB | 沿用现有 mock 的双色渐变方案，无需上传图片也能有统一视觉 |
| `ambient_order` + 局部索引 | 背景音池要能人工排序，避免每次随机都是从同一首开始 |

## 6. 接口清单

> 前缀 `/api/music`，响应 `{ code, data, message }`，时间字段为 epoch 毫秒，分页参数 `current/pageSize/sortField/sortOrder`（对齐 `api-spec.md` 通用约定）
> **作用域**：以下全部接口均以当前登录用户为作用域（`owner_id`），跨账号访问统一返回 40400。

| # | 接口 | 说明 |
|---|---|---|
| 1 | `GET /api/music/tracks` | 分页列表；参数 `keyword` `source` `ambientOnly` `tag` |
| 2 | `GET /api/music/tracks/{id}` | 详情（含播放地址与署名信息） |
| 3 | `POST /api/music/upload` | multipart 上传 + 落库（一次完成） |
| 4 | `PUT /api/music/tracks/{id}` | 更新元信息（标题/艺人/标签/许可/署名/AI 标识） |
| 5 | `PUT /api/music/tracks/{id}/ambient` | 启用/停用背景音 + 排序（`{enabled, order}`） |
| 6 | `DELETE /api/music/tracks/{id}` | 软删除 + 删 S3 对象（幂等） |
| 7 | `GET /api/music/ambient` | 背景音池（按 `ambient_order` 升序） |
| 8 | `GET /api/music/stream/{id}?token=` | **音频流代理**，支持 Range/206 |

### 6.1 播流鉴权（关键技术点）

`<audio src>` 由浏览器直连，**拿不到 `Authorization` 头**。沿用壁纸缩略图那套做法（前端 `apiUrl()`）：

1. `GET /api/music/tracks` 与 `/ambient` 下发时，为每条曲目附带 `streamUrl = /api/music/stream/{id}?token=<短时签名>`
2. token 为 **5 分钟**有效、绑定 `trackId` 的 HMAC（复用现有 JWT 密钥或单独 `music.stream.secret`）
3. 过期后前端在下次列表静默刷新时换新 token；播放中存在 token 过期不影响已建立的连接
4. **不做匿名放行**：`/api/music/stream/**` 仍需 token 校验，只是走 query 而非 header

### 6.2 播流实现（复用现有 Range 代理模式）

参照 `NavWallpaperService.video()`：

```
HEAD music/{key} → 取 contentLength + contentType（缺失时按后缀兜底 audio/mpeg）
解析 Range → GetObjectRequest.range("bytes=start-end")
返回 206 + Content-Range + Accept-Ranges: bytes
非法/越界 Range → 回退整段，绝不返回 416
```

> 为什么不能把预签名 URL 直接交给 `<audio>`：`DEPLOY.md` 坑 18 与 `NavWallpaperService` 注释已写明——预签名地址在带 Range 的请求上会被对象存储重置连接，而音频拖动进度条高度依赖 Range。

### 6.3 错误码（复用 `vc-common/ErrorCode`）

| code | 场景 |
|---|---|
| 40000 | 参数非法（后缀不在白名单 / 超过 20MB / 时长越界 / key 含 `..`） |
| 40001 | 未登录（沿用现有 `NOT_LOGIN_ERROR` 语义，按项目实际枚举对齐） |
| 40400 | 曲目不存在 / S3 对象 404 |
| 50001 | 上传失败、S3 异常（对前端提示"上传失败，请重试"） |

## 7. 前端实现规范

### 7.1 需要新增/修改的文件

| 文件 | 变更 |
|---|---|
| `src/api/music.ts` | 新增：`listTracks` / `uploadTrack`（用 `uploadFile`）/ `updateTrack` / `toggleAmbient` / `removeTrack` / `listAmbient` |
| `src/stores/musicStore.ts` | 扩展：`ambientOn`、`ambientVolume`、`currentTrackId`（`ambientOn` 与音量持久化） |
| `src/components/FloatingMusicPlayer.tsx` | 数据源换 API；新增背景音按钮与渐入渐出；单 audio 实例复用 |
| `src/pages/MusicLibrary.tsx` | 新增音乐库页 |
| `src/App.tsx` | 注册 `/music` 路由（懒加载） |
| `src/mock/music.ts` | 保留：后端不可达时兜底，类型增加 `streamUrl` 可选字段 |

### 7.2 视觉与交互约束（必须遵守）

1. 播放器**只加按钮、不改结构**：新增按钮沿用 `vc-player__icon-btn` + `is-on` 激活态
2. 音乐库页新类名走 `vc-music__*`，容器加 `glass-panel`，颜色一律用 `--color-*` / `--glass-*` 变量，禁止硬编码色值
3. 封面双色渐变由 `cover_color` 驱动；缺失时按标题 hash 生成一组，保证不出现"同一首歌每次颜色不同"
4. 列表行操作按钮统一用现有图标按钮规格（`icon-btn` 尺寸 22）
5. 删除、停用等破坏性操作走二次确认（AntD `Modal.confirm`）

### 7.3 无感规范落地（硬性）

| 场景 | 要求 |
|---|---|
| 列表静默刷新 | 修改元信息 / 启停背景音后**不整页刷新**，只重取列表并原位更新；请求期间顶部显示 2px 细进度条 |
| 切歌 | **不重建 `<audio>`**，只替换 `src` 并保留当前音量/静音状态 |
| 筛选切换 | 保留旧列表展示直到新数据返回，再替换（不出现空白闪屏） |
| 播放中编辑 | 编辑的是非当前曲目时，播放完全不受影响 |
| 失败提示 | 上传/更新失败用轻提示（toast），不弹模态打断 |
| 背景音开关 | 开关切换即时生效，无 loading 态，渐入渐出承担反馈 |

## 8. 性能与带宽

1. 上传：≤20MB，后端直传 S3（`RequestBody.fromInputStream` 或 `Path` 重载），不落本地磁盘
2. 播流：Range 代理只回传请求片段，禁止整段读进内存
3. 预加载：`preload="metadata"`，背景音下一首在切歌前 30 秒空闲时预取（`<link rel=prefetch>` 或提前设置 `src`）
4. 缓存头：`/stream` 返回 `Accept-Ranges: bytes`；同一 token 有效期内可 `Cache-Control: private, max-age=300`
5. 曲库规模：P0 ≤300 首，列表分页 20/页；背景音池 ≤8 首（超限接口直接 40000）

## 9. 风险与降级

| 风险 | 降级方案 |
|---|---|
| 浏览器拦截自动播放 | 严格等用户手势；失败静默，不弹错误，播放器逻辑不受影响 |
| S3 不可用 | 列表接口仍返回元数据（`streamUrl` 置空），前端显示"音频暂不可用"，播放器回落到 mock 兜底 |
| 服务器带宽被打满 | 背景音池限 8 首 + mp3 128kbps + 页面隐藏即停；P1 再考虑 CDN 或公开桶直链 |
| token 过期导致中途 403 | 前端捕获 `audio` 的 `error` 事件 → 静默重新拉列表换 token → 从原 `currentTime` 续播 |
| 上传大文件超时 | 前端 30s 超时提示；后端 multipart 上限单独配置（`spring.servlet.multipart.max-file-size=25MB`） |
| AI 曲目合规 | `ai_disclosure=true` 的曲目，卡片与播放器必须展示"AI 生成"标识；`license=CC-BY-NC` 在入库阶段已被拦截（枚举不含该值），不会进入库内 |

## 10. 测试用例要点（P0 验收）

1. 上传 mp3（3MB）→ 列表出现、可播放、元信息正确
2. 上传非法后缀（wav/flac/aac）/ 21MB 文件 / 13 分钟音频 → 全部拦截（40000）
2b. 传 `license=CC-BY-NC` → 后端拒绝（40000）；前端下拉中该选项不存在
3. 拖动进度条到 50% → 后端返回 206，`Content-Range` 正确，播放不中断（验证 Range 代理）
4. 未登录访问任意 `/api/music/**` → 401
5. token 过期（等 5 分钟后播流）→ 前端静默续播，不白屏、不报错弹窗
6. 背景音开启 → 音量 0.25、3 秒渐入；切页不断流；页面切到后台暂停、回前台继续
7. 背景音与手动选曲冲突 → 手动选曲自动退出背景音，无叠加音轨
8. 关闭标签页重开 → 背景音偏好被记住，但仍需用户手势才出声
9. 编辑非当前曲目元信息 → 播放不中断，列表原位更新（无整页刷新）
10. 删除当前播放曲目 → 播放器自动跳下一首，不出现"空 src 报错"
11. 背景音池加到第 9 首 → 接口拒绝并提示上限
12. 列表筛选切 "AI 生成" → 只展示 `ai_disclosure=true` 的曲目，卡片显示标识

## 11. 落地依赖缺口（编码前必须补）

1. **新建后端模块 `vc-music`**：`pom.xml` 需加入根 `pom.xml` 的 `<modules>`，并在 `vc-app/pom.xml` 增加依赖；包名 `com.vc.music`（entity / mapper / service / controller / dto 五层，对齐 `vc-nav` 结构）
2. **`vc-common/S3Bucket` 增加枚举** `MUSIC("music", false, "音乐音频，私有读写")`；桶需运维在 RustFS 创建为**私有**
3. **SQL**：`VeythCog-C/docs/sql/022_music.sql`（需在现有 021 之后编号，执行前确认当前库最大编号）
4. **multipart 上限**：`vc-app/src/main/resources/application.yml` 增加 `spring.servlet.multipart.max-file-size: 25MB` / `max-request-size: 30MB`
5. **播流 token 密钥**：复用现有 JWT secret 或新增 `music.stream.secret`（写入 `.env.example`）
6. **前端 `package.json`**：无新增依赖（AntD 5、Iconify、Zustand 已具备）

## 12. 已确认决策（v0.2，2026-11-15 评审）

| # | 决策 | 结论 | 落地位置 |
|---|---|---|---|
| 1 | 音乐库页位置 | **`/music` 前台页**，且**曲库与账号绑定** | §3 路由、§5 `owner_id`、§6 作用域 |
| 2 | 入库格式 | **仅 mp3 / m4a**（wav/flac 不收） | §1.4 约束 1、§6.3 错误码 |
| 3 | CC-BY-NC 曲目 | **直接禁止**：许可枚举不提供该值，接口二次校验拒绝 | §1.4 约束 7、§5.1、§6.3 |
| 4 | 未登录能否听背景音 | **不能**，与全站权限一致 | §2 权限矩阵 |
| 5 | 背景音默认音量 | 0.25（可后续按听感微调，不改结构） | §4.1 |
| 6 | 背景音池上限 | 8 首（超限接口拒绝） | §4.1、§8 |

> 以上 6 项已定，不再作为待确认项；后续若要放宽（例如允许 flac），需先改 §5.1 枚举与 §6.3 校验，再同步 spec。

## 13. 面试亮点说明（可直接放进 README）

> 音乐模块没有另起播放器，而是**复用已落地的悬浮播放器单实例**，把"背景音"定义为播放器的一个模式，从结构上消除双音轨问题；音频不走预签名直链，而是复用壁纸模块已验证的 **S3 Range 代理**（206 Partial Content），解决对象存储在 Range 请求上重置连接导致的拖动进度条失效；`<audio>` 无法携带 `Authorization`，因此引入**短时签名 query token**（5 分钟、绑定 trackId），配合列表静默刷新实现无感续播；数据模型强制携带 `source/license/attribution/ai_disclosure`，为后续接入 CC 曲库与 AI 生成内容预留合规位点。

## 14. 与 OpenSpec 的落地映射

评审通过后按下表拆分为 OpenSpec change（目录命名对齐现有 `changes/p1-xxx` 风格）：

| 产物 | 路径 |
|---|---|
| 变更提案 | `openspec/changes/p1-music-library/proposal.md` |
| 技术设计 | 同上 `/design.md`（含 Range 代理与 token 方案） |
| 任务拆分 | 同上 `/tasks.md` |
| 能力规格 | 同上 `/specs/music-library/spec.md` |
| 接口契约 | 追加到 `openspec/api-spec.md` 或新建 `openspec/music-api.md` |
