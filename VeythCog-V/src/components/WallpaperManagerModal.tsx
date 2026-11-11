import React from 'react';
import { Modal, Spin } from 'antd';
import { Icon } from '@iconify/react';
import closeIcon from '@iconify-icons/lucide/x';
import imageIcon from '@iconify-icons/lucide/image';
import filmIcon from '@iconify-icons/lucide/film';
import { useTheme } from '@/contexts/ThemeContext';
import { useWallpaperStore, wallpaperKind } from '@/stores/wallpaperStore';
import { apiUrl } from '@/api/client';

interface Props {
  open: boolean;
  onClose: () => void;
}

type Tab = 'image' | 'video';

const TAB_META: { key: Tab; label: string; icon: typeof imageIcon }[] = [
  { key: 'image', label: '静态壁纸', icon: imageIcon },
  { key: 'video', label: '动态壁纸', icon: filmIcon },
];

/** 壁纸缩略图地址：后端同源代理，缩到 480px 并带 7 天长缓存，只需下载一次 */
const thumbUrl = (key: string) =>
  apiUrl('/nav/wallpaper/thumb', { key });

/**
 * 缩略图：直连后端缩略图接口 + 原生懒加载。
 * 地址只由壁纸 key 决定，稳定不变，浏览器可长期命中 HTTP 缓存。
 */
const ThumbImage: React.FC<{ itemKey: string }> = ({ itemKey }) => (
  <img
    src={thumbUrl(itemKey)}
    alt=""
    loading="lazy"
    decoding="async"
    style={{
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      display: 'block',
    }}
  />
);

/**
 * 壁纸管理弹窗（参照 iTab 壁纸库）：左侧分类、右侧缩略图网格。
 * 图片全部来自 S3 壁纸桶（/nav/wallpaper/list），点选即切换并全局生效。
 */
const WallpaperManagerModal: React.FC<Props> = ({ open, onClose }) => {
  const { colors } = useTheme();
  const active = useWallpaperStore((s) => s.active);
  const list = useWallpaperStore((s) => s.list);
  const loadingList = useWallpaperStore((s) => s.loadingList);
  const loadList = useWallpaperStore((s) => s.loadList);
  const select = useWallpaperStore((s) => s.select);
  const [tab, setTab] = React.useState<Tab>('image');

  React.useEffect(() => {
    if (open) loadList();
  }, [open, loadList]);

  const counts = React.useMemo(() => {
    let image = 0;
    let video = 0;
    for (const item of list) {
      if (wallpaperKind(item.key) === 'video') video += 1;
      else image += 1;
    }
    return { image, video };
  }, [list]);

  const items = React.useMemo(
    () => list.filter((item) => wallpaperKind(item.key) === tab),
    [list, tab],
  );

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={920}
      centered
      closable={false}
      title={null}
      styles={{ body: { padding: 0 }, content: { padding: 0, overflow: 'hidden', borderRadius: 16 } }}
    >
      <div style={{ position: 'relative', display: 'flex', height: 'min(600px, 76vh)', background: colors.surface }}>
        {/* 关闭按钮：灰底圆角方块（参照 iTab 壁纸库右上角） */}
        <button
          onClick={onClose}
          aria-label="关闭"
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            zIndex: 3,
            width: 34,
            height: 34,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            borderRadius: 10,
            cursor: 'pointer',
            background: 'rgba(120,125,150,0.14)',
            color: colors.textSecondary,
            transition: 'background .15s ease, color .15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(120,125,150,0.26)';
            e.currentTarget.style.color = colors.text;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(120,125,150,0.14)';
            e.currentTarget.style.color = colors.textSecondary;
          }}
        >
          <Icon icon={closeIcon} width={16} />
        </button>
        {/* 左栏：分类 */}
        <div
          style={{
            width: 200,
            flexShrink: 0,
            borderRight: `1px solid ${colors.border}`,
            padding: '20px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <div style={{ fontSize: 20, fontWeight: 700, color: colors.text, padding: '0 12px 14px' }}>
            壁纸库
          </div>
          {TAB_META.map((t) => {
            const selected = tab === t.key;
            return (
              <div
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 10,
                  cursor: 'pointer',
                  background: selected ? colors.primary10 : 'transparent',
                  color: selected ? colors.primary : colors.textSecondary,
                  transition: 'background .2s',
                }}
                onMouseEnter={(e) => {
                  if (!selected) e.currentTarget.style.background = colors.surfaceElevated;
                }}
                onMouseLeave={(e) => {
                  if (!selected) e.currentTarget.style.background = 'transparent';
                }}
              >
                <Icon icon={t.icon} width={17} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 14, fontWeight: selected ? 600 : 400, flex: 1 }}>{t.label}</span>
                <span style={{ fontSize: 12, opacity: 0.7 }}>{counts[t.key]}</span>
              </div>
            );
          })}

          <div style={{ marginTop: 'auto', padding: '0 12px', fontSize: 12, color: colors.textTertiary, lineHeight: 1.6 }}>
            选中后立即应用到全站，并保存到你的账号
          </div>
        </div>

        {/* 右栏：缩略图网格 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {loadingList && (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Spin />
            </div>
          )}

          {!loadingList && items.length === 0 && (
            <div
              style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                color: colors.textTertiary,
              }}
            >
              <Icon icon={tab === 'video' ? filmIcon : imageIcon} width={30} />
              <span style={{ fontSize: 13 }}>
                {tab === 'video' ? '壁纸库里还没有动态壁纸' : '壁纸库里还没有静态壁纸'}
              </span>
            </div>
          )}

          {!loadingList && items.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                gap: 14,
                alignContent: 'start',
              }}
            >
              {items.map((item) => {
                const selected = active?.key === item.key;
                const kind = wallpaperKind(item.key);
                return (
                  <div
                    key={item.key}
                    onClick={() => select(item)}
                    style={{
                      position: 'relative',
                      height: 104,
                      minWidth: 0,
                      borderRadius: 12,
                      overflow: 'hidden',
                      cursor: 'pointer',
                      background: colors.surfaceElevated,
                      border: `2px solid ${selected ? colors.primary : 'transparent'}`,
                      boxShadow: selected ? `0 6px 18px ${colors.primary30}` : 'none',
                      transition: 'transform .18s ease, box-shadow .18s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    {kind === 'video' ? (
                      <video
                        src={item.url}
                        muted
                        loop
                        playsInline
                        autoPlay
                        preload="metadata"
                        style={{
                          position: 'absolute',
                          inset: 0,
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          display: 'block',
                        }}
                      />
                    ) : (
                      <ThumbImage itemKey={item.key} />
                    )}

                    {selected && (
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'rgba(0,0,0,0.18)',
                        }}
                      >
                        <div
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: '50%',
                            background: colors.primary,
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 16,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                          }}
                        >
                          ✓
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default WallpaperManagerModal;
