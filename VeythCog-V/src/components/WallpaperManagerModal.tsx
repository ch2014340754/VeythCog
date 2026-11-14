import React from 'react';
import { Modal, Spin } from 'antd';
import { Icon } from '@iconify/react';
import closeIcon from '@iconify-icons/lucide/x';
import refreshIcon from '@iconify-icons/lucide/refresh-cw';
import maximizeIcon from '@iconify-icons/lucide/maximize-2';
import minimizeIcon from '@iconify-icons/lucide/minimize-2';
import imageIcon from '@iconify-icons/lucide/image';
import filmIcon from '@iconify-icons/lucide/film';
import checkIcon from '@iconify-icons/lucide/check';
import { useWallpaperStore, resolveWallpaperKind } from '@/stores/wallpaperStore';
import { apiUrl } from '@/api/client';
import WallpaperMedia from '@/components/WallpaperMedia';

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
 * 壁纸管理弹窗（参照 iTab 壁纸库）：左侧分类、右侧缩略图网格。
 * 图片全部来自 S3 壁纸桶（/nav/wallpaper/list），点选即切换并全局生效。
 * 视觉上沿用全站玻璃/圆角/主色令牌，壁纸机制本身仍由 wallpaperStore 统一管理。
 */
const WallpaperManagerModal: React.FC<Props> = ({ open, onClose }) => {
  const active = useWallpaperStore((s) => s.active);
  const list = useWallpaperStore((s) => s.list);
  const loadingList = useWallpaperStore((s) => s.loadingList);
  const loadList = useWallpaperStore((s) => s.loadList);
  const select = useWallpaperStore((s) => s.select);
  const [tab, setTab] = React.useState<Tab>('image');
  const [expanded, setExpanded] = React.useState(false);

  React.useEffect(() => {
    if (open) loadList();
    else setExpanded(false);
  }, [open, loadList]);

  /** 顶部工具按钮：统一 34px 圆角图标按钮，跟随主题 */
  const toolButton = (
    icon: typeof closeIcon,
    label: string,
    onClick: () => void,
    options?: { active?: boolean; spinning?: boolean; disabled?: boolean },
  ) => {
    const { active = false, spinning = false, disabled = false } = options ?? {};
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        title={label}
        disabled={disabled}
        className={'vc-wallpaper__tool' + (active ? ' is-active' : '')}
      >
        <Icon icon={icon} width={16} className={spinning ? 'vc-spin' : undefined} />
      </button>
    );
  };

  const counts = React.useMemo(() => {
    let image = 0;
    let video = 0;
    for (const item of list) {
      if (resolveWallpaperKind(item) === 'video') video += 1;
      else image += 1;
    }
    return { image, video };
  }, [list]);

  const items = React.useMemo(
    () => list.filter((item) => resolveWallpaperKind(item) === tab),
    [list, tab],
  );

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={expanded ? '100vw' : 920}
      centered={!expanded}
      closable={false}
      title={null}
      rootClassName="vc-wallpaper-modal"
      style={expanded ? { top: 0, margin: 0, maxWidth: '100vw', paddingBottom: 0 } : undefined}
      styles={{
        body: { padding: 0 },
        content: {
          padding: 0,
          overflow: 'hidden',
          borderRadius: expanded ? 0 : 'var(--radius-lg)',
          height: expanded ? '100vh' : undefined,
        },
      }}
    >
      <div className={'vc-wallpaper' + (expanded ? ' is-expanded' : '')}>
        {/* 左栏：分类 */}
        <aside className="vc-wallpaper__nav">
          <div className="vc-wallpaper__title">壁纸库</div>
          {TAB_META.map((t) => {
            const selected = tab === t.key;
            return (
              <button
                type="button"
                key={t.key}
                onClick={() => setTab(t.key)}
                className={'vc-wallpaper__tab' + (selected ? ' is-active' : '')}
              >
                <Icon icon={t.icon} width={17} />
                <span className="vc-wallpaper__tab-label">{t.label}</span>
                <span className="vc-wallpaper__tab-count">{counts[t.key]}</span>
              </button>
            );
          })}

          <div className="vc-wallpaper__hint">选中后立即应用到全站，并保存到你的账号</div>
        </aside>

        {/* 右栏：顶部工具栏 + 缩略图网格 */}
        <div className="vc-wallpaper__main">
          <div className="vc-wallpaper__tools">
            {toolButton(refreshIcon, loadingList ? '正在刷新壁纸' : '刷新壁纸', () => void loadList(true), {
              disabled: loadingList,
              spinning: loadingList,
            })}
            {toolButton(
              expanded ? minimizeIcon : maximizeIcon,
              expanded ? '退出全屏' : '放大弹窗至全屏',
              () => setExpanded((v) => !v),
              { active: expanded },
            )}
            {toolButton(closeIcon, '关闭弹窗', onClose)}
          </div>

          <div className="vc-wallpaper__scroll">
            {loadingList && items.length === 0 && (
              <div className="vc-wallpaper__loading">
                <Spin />
              </div>
            )}

            {!loadingList && items.length === 0 && (
              <div className="vc-wallpaper__empty">
                <Icon icon={tab === 'video' ? filmIcon : imageIcon} width={28} />
                <span>{tab === 'video' ? '壁纸库里还没有动态壁纸' : '壁纸库里还没有静态壁纸'}</span>
              </div>
            )}

            {items.length > 0 && (
              <div className="vc-wallpaper__grid">
                {items.map((item) => {
                  const selected = active?.key === item.key;
                  const kind = resolveWallpaperKind(item);
                  return (
                    <button
                      type="button"
                      key={item.key}
                      onClick={() => select(item)}
                      className={'vc-wallpaper__card' + (selected ? ' is-selected' : '')}
                      aria-label={selected ? '当前壁纸' : '应用该壁纸'}
                    >
                      {/* 类型由服务端下发的 kind 决定：静态图走缩略图接口，动态壁纸走 <video> 播原视频 */}
                      <WallpaperMedia
                        item={item}
                        imageSrc={kind === 'image' ? thumbUrl(item.key) : undefined}
                        style={{ position: 'absolute', inset: 0, height: '100%' }}
                        fallbackText={kind === 'video' ? '视频加载失败' : '缩略图加载失败'}
                      />

                      {selected && (
                        <span className="vc-wallpaper__check">
                          <span className="vc-wallpaper__check-badge">
                            <Icon icon={checkIcon} width={16} />
                          </span>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default WallpaperManagerModal;
