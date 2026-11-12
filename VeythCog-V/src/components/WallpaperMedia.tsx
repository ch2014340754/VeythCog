import React from 'react';
import { resolveWallpaperKind } from '@/stores/wallpaperStore';
import { wallpaperVideoUrl, type WallpaperItem } from '@/api/nav';

interface Props {
  item: WallpaperItem;
  /** 静态图专用地址（壁纸库传后端缩略图接口，其它地方不传则用原图） */
  imageSrc?: string;
  /** 覆盖媒体元素的样式，默认铺满父容器 */
  style?: React.CSSProperties;
  /** 视频是否自动播放（列表卡片、预览、全屏背景都为 true） */
  autoPlay?: boolean;
  /** 加载失败时的占位文案 */
  fallbackText?: string;
}

const mediaStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
};

/**
 * 壁纸媒体渲染器：**唯一入口**。
 * 服务端下发的 kind 决定用 <video> 还是 <img>，因此 mp4 / webm 永远不会被塞进 <img> 变成裂图；
 * kind 缺失（旧缓存）时按 key 后缀回退，后缀也判不出来按静态图处理。
 */
const WallpaperMedia: React.FC<Props> = ({
  item,
  imageSrc,
  style,
  autoPlay = true,
  fallbackText = '加载失败',
}) => {
  const [failed, setFailed] = React.useState(false);

  // 刷新清单后 key 可能不变、只有预签名 url 换新；失败状态也必须跟着地址重置，
  // 否则“刷新壁纸”后仍停在上一轮的失败占位上。
  React.useEffect(() => {
    setFailed(false);
  }, [item.key, item.url, imageSrc]);

  if (failed) {
    return (
      <div
        style={{
          ...mediaStyle,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 12,
          color: 'rgba(140,140,150,0.9)',
          background: 'rgba(130,130,150,0.12)',
        }}
      >
        {fallbackText}
      </div>
    );
  }

  const kind = resolveWallpaperKind(item);

  if (kind === 'video') {
    return (
      <video
        key={item.key}
        src={wallpaperVideoUrl(item.key)}
        autoPlay={autoPlay}
        loop
        muted
        playsInline
        preload="auto"
        onError={() => setFailed(true)}
        style={{ ...mediaStyle, ...style }}
      />
    );
  }

  return (
    <img
      key={item.key}
      src={imageSrc ?? item.url}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      style={{ ...mediaStyle, ...style }}
    />
  );
};

export default WallpaperMedia;
