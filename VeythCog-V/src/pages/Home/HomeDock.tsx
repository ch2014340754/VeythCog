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
      className={`vc-dock${dimmed ? ' is-dimmed' : ''}`}
      onMouseEnter={() => {
        hoverRef.current = true;
        wake();
      }}
      onMouseLeave={() => {
        hoverRef.current = false;
        scheduleFade();
      }}
    >
      {actions.map((action) => (
        <button
          key={action.key}
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
