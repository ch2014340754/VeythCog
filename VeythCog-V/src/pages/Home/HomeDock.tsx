import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import layoutGridIcon from '@iconify-icons/lucide/layout-grid';
import listMusicIcon from '@iconify-icons/lucide/list-music';
import mailIcon from '@iconify-icons/lucide/mail';
import wrenchIcon from '@iconify-icons/lucide/wrench';
import bookOpenIcon from '@iconify-icons/lucide/book-open';
import messageSquareIcon from '@iconify-icons/lucide/message-square';
import settingsIcon from '@iconify-icons/lucide/settings';
import { message } from 'antd';
import { useMusicStore } from '@/stores/musicStore';

interface DockAction {
  key: string;
  label: string;
  icon: typeof layoutGridIcon;
  onClick: () => void;
  /** 开关类按钮的激活态（如版块显示中） */
  active?: boolean;
}

/**
 * 首页底部工具条：毛玻璃居中长条。
 * - 第一个：切换书签图标版块的显示 / 隐藏（动画在 Home 容器上）
 * - 其余：音乐、邮箱（占位）、工具集、知识库、对话、设置等常用入口
 * 视觉全部由 .vc-dock / .vc-dock__item 提供（含 body.has-bg 壁纸白玻璃变体）。
 *
 * 交互沿用 macOS Dock：指针横向移动时，图标按"离指针的距离"放大（高斯衰减），
 * 同时把左右邻居按实际放大后的宽度往外推——不是单个 hover 放大，而是整条像被磁铁吸起来。
 * 布局值（offsetLeft / offsetWidth）只在尺寸变化时量一次缓存，pointermove 里不做任何
 * getBoundingClientRect，避免每帧强制 layout。
 */
const HomeDock: React.FC<{ gridVisible: boolean; onToggleGrid: () => void }> = ({
  gridVisible,
  onToggleGrid,
}) => {
  const navigate = useNavigate();
  const openMusic = useMusicStore((s) => s.open);

  /** 空闲渐隐：与首页搜索框一致，鼠标未悬停 3 分钟后淡化为淡轮廓，进入即恢复 */
  const FADE_TIMEOUT_MS = 3 * 60 * 1000;
  const [dimmed, setDimmed] = React.useState(false);
  const hoverRef = React.useRef(false);
  const fadeTimerRef = React.useRef<number | null>(null);

  const clearFadeTimer = React.useCallback(() => {
    if (fadeTimerRef.current !== null) {
      window.clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
  }, []);

  const scheduleFade = React.useCallback(() => {
    clearFadeTimer();
    if (hoverRef.current) {
      setDimmed(false);
      return;
    }
    fadeTimerRef.current = window.setTimeout(() => {
      fadeTimerRef.current = null;
      setDimmed(true);
    }, FADE_TIMEOUT_MS);
  }, [clearFadeTimer]);

  const wake = React.useCallback(() => {
    clearFadeTimer();
    setDimmed(false);
    scheduleFade();
  }, [clearFadeTimer, scheduleFade]);

  React.useEffect(() => {
    scheduleFade();
    return clearFadeTimer;
  }, [scheduleFade, clearFadeTimer]);

  /* ---------- Dock 放大（macOS 磁吸） ---------- */

  const dockRef = React.useRef<HTMLDivElement | null>(null);
  const itemRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const layoutRef = React.useRef<{
    centers: number[];
    widths: number[];
    gap: number;
    left: number;
    dockLeft: number;
  } | null>(null);
  const rafRef = React.useRef<number | null>(null);
  const pointerXRef = React.useRef<number | null>(null);

  /**
   * 量的全是布局值（offsetLeft / offsetWidth），不受 transform 影响；
   * 只在挂载与窗口尺寸变化时重算，pointermove 里一次 getBoundingClientRect 都不读。
   */
  const measureDock = React.useCallback(() => {
    const dock = dockRef.current;
    const items = itemRefs.current.filter((el): el is HTMLButtonElement => !!el);
    if (!dock || !items.length) return;
    const centers = items.map((el) => el.offsetLeft + el.offsetWidth / 2);
    const widths = items.map((el) => el.offsetWidth);
    const gap =
      items.length > 1 ? centers[1] - centers[0] - (widths[0] + widths[1]) / 2 : 0;
    layoutRef.current = {
      centers,
      widths,
      gap,
      left: items[0].offsetLeft,
      dockLeft: dock.getBoundingClientRect().left,
    };
  }, []);

  const resetDock = React.useCallback(() => {
    pointerXRef.current = null;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    itemRefs.current.forEach((el) => {
      if (!el) return;
      el.style.removeProperty('--dock-scale');
      el.style.removeProperty('--dock-dx');
    });
  }, []);

  const applyMagnify = React.useCallback(() => {
    rafRef.current = null;
    const layout = layoutRef.current;
    const x = pointerXRef.current;
    if (!layout || x === null) return;
    const items = itemRefs.current.filter((el): el is HTMLButtonElement => !!el);
    if (items.length !== layout.centers.length) return;

    // σ 跟着图标间距走，避免间距变大后邻居被"真空"或整条一起抬起来
    const sigma = Math.max(46, (layout.widths[0] + layout.gap) * 1.25);
    const AMP = 0.52; // 指针正下方最多 1.52 倍
    const scales = layout.centers.map(
      (c) => 1 + AMP * Math.exp(-(((x - c) / sigma) ** 2)),
    );
    const widths = layout.widths.map((w, i) => w * scales[i]);
    const total = widths.reduce((a, b) => a + b, 0) + layout.gap * (widths.length - 1);
    const baseTotal =
      layout.widths.reduce((a, b) => a + b, 0) + layout.gap * (layout.widths.length - 1);

    // 放大后的总宽以原中心为轴左右对称撑开，再把每个图标的中心位移成 translateX
    let edge = layout.left + (baseTotal - total) / 2;
    for (let i = 0; i < items.length; i += 1) {
      const dx = edge + widths[i] / 2 - layout.centers[i];
      items[i].style.setProperty('--dock-scale', scales[i].toFixed(3));
      items[i].style.setProperty('--dock-dx', `${dx.toFixed(1)}px`);
      edge += widths[i] + layout.gap;
    }
  }, []);

  const handleDockPointerMove = React.useCallback(
    (ev: React.PointerEvent<HTMLDivElement>) => {
      if (ev.pointerType !== 'mouse') return;
      if (layoutRef.current === null) measureDock();
      const layout = layoutRef.current;
      if (!layout) return;
      pointerXRef.current = ev.clientX - layout.dockLeft;
      if (rafRef.current === null) rafRef.current = requestAnimationFrame(applyMagnify);
    },
    [applyMagnify, measureDock],
  );

  React.useEffect(() => {
    measureDock();
    const onResize = () => {
      resetDock();
      measureDock();
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      resetDock();
    };
  }, [measureDock, resetDock]);

  const actions: DockAction[] = [
    {
      key: 'toggle-grid',
      label: gridVisible ? '隐藏书签版块' : '显示书签版块',
      icon: layoutGridIcon,
      onClick: onToggleGrid,
      active: gridVisible,
    },
    { key: 'music', label: '音乐管理', icon: listMusicIcon, onClick: openMusic },
    {
      key: 'mail',
      label: '邮箱管理',
      icon: mailIcon,
      onClick: () => message.info('邮箱管理即将上线'),
    },
    { key: 'tools', label: '工具集', icon: wrenchIcon, onClick: () => navigate('/tools') },
    { key: 'knowledge', label: '知识库', icon: bookOpenIcon, onClick: () => navigate('/knowledge') },
    { key: 'chat', label: '对话', icon: messageSquareIcon, onClick: () => navigate('/chat') },
    { key: 'settings', label: '设置', icon: settingsIcon, onClick: () => navigate('/settings') },
  ];

  return (
    <div
      ref={dockRef}
      className={`vc-dock${dimmed ? ' is-dimmed' : ''}`}
      onPointerEnter={() => {
        hoverRef.current = true;
        wake();
      }}
      onPointerMove={handleDockPointerMove}
      onPointerLeave={() => {
        hoverRef.current = false;
        scheduleFade();
        resetDock();
      }}
    >
      {actions.map((action, index) => (
        <button
          key={action.key}
          ref={(el) => {
            itemRefs.current[index] = el;
          }}
          type="button"
          className={`vc-dock__item${action.active ? ' is-active' : ''}`}
          title={action.label}
          aria-label={action.label}
          aria-pressed={action.active ? true : undefined}
          onClick={action.onClick}
        >
          <Icon icon={action.icon} width={22} />
        </button>
      ))}
    </div>
  );
};

export default HomeDock;
