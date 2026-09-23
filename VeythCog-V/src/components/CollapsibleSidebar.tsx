import React from 'react';
import { Icon } from '@iconify/react';
import chevronLeftIcon from '@iconify-icons/lucide/chevron-left';
import chevronRightIcon from '@iconify-icons/lucide/chevron-right';
import { useTheme } from '@/contexts/ThemeContext';
import { useSettingsStore } from '@/stores/settingsStore';

interface CollapsibleSidebarProps {
  /** 展开时的侧栏宽度（px） */
  width?: number;
  children: React.ReactNode;
}

/** 把手距顶部的距离（px） */
const HANDLE_TOP = 50;
/** 露出的把手宽度（右半，px） */
const HANDLE_VISIBLE = 16;
/** 完整胶囊宽度 = 露出宽度 × 2（左半被裁剪窗口裁掉） */
const HANDLE_FULL = HANDLE_VISIBLE * 2;

/**
 * 可折叠侧栏外壳：
 * - 默认展开，距顶部 50px 处有一个贴在侧栏右缘的竖条把手
 * - 把手用一个 overflow:hidden 的小窗口贴在右缘，把完整胶囊的左半直接裁掉，只露右半
 *   （物理裁剪，不依赖不透明底色，毛玻璃半透明模式下也不会透出来）
 * - 收起后侧栏宽度动画收缩到 0，裁剪窗口仍贴在内容区左缘、只露右半，点击重新展开
 * - 收起状态持久化在 settingsStore（sidebarCollapsed），跨页面、刷新保留
 */
const CollapsibleSidebar: React.FC<CollapsibleSidebarProps> = ({ width = 280, children }) => {
  const { colors } = useTheme();
  const collapsed = useSettingsStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useSettingsStore((s) => s.toggleSidebar);

  return (
    <div
      style={{
        position: 'relative',
        flexShrink: 0,
        width: collapsed ? 0 : width,
        height: '100%',
        transition: 'width 0.28s var(--spring)',
      }}
    >
      {/* 裁剪层：侧栏内容。其半透明 surface 底色由毛玻璃决定，不承担遮盖把手的职责 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          background: colors.surface,
          borderRight: collapsed ? 'none' : `1px solid ${colors.divider}`,
          zIndex: 1,
        }}
      >
        <div
          style={{
            width,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {children}
        </div>
      </div>

      {/* 把手裁剪窗口：贴在侧栏右缘，宽度=露出宽度，overflow hidden 把胶囊左半裁掉 */}
      <div
        style={{
          position: 'absolute',
          top: HANDLE_TOP,
          left: '100%',
          width: HANDLE_VISIBLE,
          height: 56,
          overflow: 'hidden',
          zIndex: 20,
        }}
      >
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label={collapsed ? '展开侧栏' : '收起侧栏'}
          title={collapsed ? '展开侧栏' : '收起侧栏'}
          style={{
            position: 'absolute',
            top: 0,
            // 胶囊整体左移一个露出宽度：左半落在裁剪窗口外被裁掉，右半露在窗口里
            left: -HANDLE_VISIBLE,
            width: HANDLE_FULL,
            height: 56,
            display: 'flex',
            alignItems: 'center',
            // 箭头落在露出的右半区（按钮本地 16..32）并居中
            justifyContent: 'flex-start',
            paddingLeft: HANDLE_VISIBLE + 1,
            paddingRight: 0,
            border: `1px solid ${colors.divider}`,
            borderRadius: HANDLE_VISIBLE,
            background: colors.surfaceElevated,
            color: colors.textSecondary,
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            transition: 'background 0.15s, color 0.15s, border-color 0.15s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = colors.primary10;
            (e.currentTarget as HTMLButtonElement).style.color = colors.primary;
            (e.currentTarget as HTMLButtonElement).style.borderColor = colors.primary30;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = colors.surfaceElevated;
            (e.currentTarget as HTMLButtonElement).style.color = colors.textSecondary;
            (e.currentTarget as HTMLButtonElement).style.borderColor = colors.divider;
          }}
        >
          <Icon
            icon={collapsed ? chevronRightIcon : chevronLeftIcon}
            width={14}
          />
        </button>
      </div>
    </div>
  );
};

export default CollapsibleSidebar;
