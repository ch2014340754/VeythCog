# Design · P1 音乐库与网站背景音

> 关联：`proposal.md`、`openspec/music-prd.md`
> 版本：v0.1（2026-11-15）

## 1. 模块位置与依赖方向

现有依赖方向为 `common ← (chat, knowledge, nav) ← app`。音乐模块与 `vc-nav` 同层：

```
vc-common (S3 / Result / ErrorCode)
   ↑
vc-music (entity / mapper / service / controller / dto)
   ↑
vc-app (聚合启动 + application.yml)
```

需要改动：
1. 根 `pom.xml`：`<modules>` 增加 `vc-music`
2. `vc-app/pom.xml`：增加 `vc-music` 依赖

包结构对齐 `vc-nav`：`com.vc.music.{entity,mapper,service,controller,dto}`。

## 2. 存储设计

### 2.1 桶

`vc-common/S3Bucket` 新增：

```java
MUSIC("music", false, "音乐音频，私有读写"),
```

私有桶，全部访问走后端代理或预签名；桶由运维在 RustFS 创建。

### 2.2 key 规则

```
music/{ownerId}/{yyyy}/{uuid}.mp3
```

- 按 `ownerId` 分目录：便于按账号清理，也避免单目录过大
- `uuid` 防止同名覆盖与猜测
- 扩展名取自校验后的真实后缀（`mp3` / `m4a`），不信任用户原文件名

工具方法复用 `vc-common` 的 `S3ObjectKeyUtils#buildKey`（若签名不匹配则在本模块内实现对等实现，但禁止直接写桶名字符串）。

## 3. 播流：Range 代理

参照 `NavWallpaperService#video(String key, String rangeHeader)`：

```
1. 校验 token（query）→ 解析 trackId → 校验归属 ownerId
2. HEAD music/{object_key} → contentLength / contentType（缺失按后缀兜底）
   mp3 → audio/mpeg，m4a → audio/mp4
3. 解析单段 Range（bytes=start-end / bytes=start- / bytes=-suffix）
   非法或越界 → 回退整段（绝不返回 416）
4. GetObjectRequest.range("bytes=start-end") → 返回
   206 Partial Content
   Content-Range: bytes start-end/total
   Accept-Ranges: bytes
   Content-Type: audio/*
5. Range 为空时返回 200 全量（同样流式，不读进内存）
```

Controller 负责按 `partial` 设置状态码与头，Service 返回流 + 元信息（与壁纸 `VideoStream` 同构，但独立 record，不跨模块复用内部类型）。

**为什么不用预签名直链**：对象存储在带 Range 的请求上会重置连接，而 `<audio>` 拖动进度条依赖 Range；`DEPLOY.md` 坑 18 与壁纸模块注释已记录该结论。

## 4. 播流 token

`<audio src>` 无法携带 `Authorization`，因此：

- 列表/详情/背景音池下发时，为每条曲目生成 `streamUrl = /api/music/stream/{id}?token=<sign>`
- token 内容：`trackId + ownerId + exp`，HMAC-SHA256 签名，**有效期 5 分钟**
- 密钥：`music.stream.secret`（缺省回落 `${jwt.secret}`，写入 `.env.example`）
- 校验失败 → 401/40000（不区分"不存在"与"无权"，避免探测）
- 过期不影响已建立连接；前端下一次静默刷新列表拿新 token

## 5. 服务层职责边界

| 类 | 职责 |
|---|---|
| `MusicTrackService` | CRUD、分页、归属校验、许可枚举校验、背景音池排序与上限 |
| `MusicStreamService` | HEAD + Range 解析 + 取流；不含业务权限判断（由 Controller 传入已校验的 owner） |
| `MusicStreamTokenService` | 签发/校验短时 token |
| `MusicController` | 参数校验 → 调 Service → 组装 `BaseResponse`；文件上传走 multipart |

统一通过 `ThrowUtils.throwIf(...)` 抛 `BusinessException`，由 `GlobalExceptionHandler` 包装，**不手写 try/catch 返回结构**。

## 6. 前端结构

### 6.1 状态

`musicStore` 扩展（保持现有 `pinned/opened` 语义不变）：

```
ambientOn: boolean            // persist
ambientVolume: number = 0.25  // persist
currentTrackId: string | null
setAmbientOn / setAmbientVolume / setCurrentTrackId
```

播放列表不放进 store（属于播放器内部状态 + 接口数据），避免两处真相。

### 6.2 单 audio 实例

`FloatingMusicPlayer` 已持有 `audioRef`，背景下**只改 src 与 volume**，不新建 `Audio()`。状态机：

```
手动播放 --点击背景音开关--> 背景音模式（音量 0.25，渐入 3s）
背景音模式 --用户点选曲目--> 自动退出背景音，恢复手动音量
背景音模式 --document.hidden--> pause，可见时 resume
```

渐入/渐出用 `requestAnimationFrame` 步进或 `setInterval(50ms)` 线性调整，不用 Web Audio API（避免与 `<audio>` 音量双控）。

### 6.3 页面

`src/pages/MusicLibrary.tsx`：AntD `Table` + 上传 `Modal`，类名 `vc-music__*`，容器 `glass-panel`，颜色只用变量。

### 6.4 无感约束

- 列表刷新用细进度条（2px，顶部），不整页 loading
- 筛选切换保留旧数据直到新数据返回
- 编辑非当前曲目不影响播放
- 失败只 toast

## 7. 配置项

| key | 位置 | 说明 |
|---|---|---|
| `spring.servlet.multipart.max-file-size` | `vc-app/application.yml` | 25MB |
| `spring.servlet.multipart.max-request-size` | 同上 | 30MB |
| `music.stream.secret` | `.env.example` + yml | 播流 token 密钥 |
| `music.stream.token-ttl` | 同上 | 300s |
| `music.ambient.max-tracks` | 同上 | 8 |

## 8. 数据一致性

- 删除：先软删 DB（`deleted=true`），再删 S3 对象（幂等）；S3 删失败只记 `WARN`，不回滚 DB（下一次清理任务兜底，P0 不做定时任务）
- 上传：先传 S3 → 再落库；落库失败则回删对象（补偿），避免孤儿文件堆积
- `ambient_order`：入池时取 `max(order)+1`，避免并发写入同序号

## 9. 测试策略

- 后端：Range 解析单测（合法/越界/后缀/多段）、token 过期与篡改、许可枚举校验、跨账号 40400
- 前端：手动验收（12 条 PRD 用例），重点验证后台切换暂停、token 过期续播
