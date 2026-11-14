import chevronLeftIcon from '@iconify-icons/lucide/chevron-left';
import chevronRightIcon from '@iconify-icons/lucide/chevron-right';
import { Icon } from '@iconify/react';
import { useSettingsStore } from '@/stores/settingsStore';
import React from 'react';

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
  const collapsed = useSettingsStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useSettingsStore((s) => s.toggleSidebar);

  return (
    <div
      className={'vc-collapse' + (collapsed ? ' is-collapsed' : '')}
      style={{ width: collapsed ? 0 : width }}
    >
      {/* 裁剪层：侧栏内容。半透明 surface 底色由主题/玻璃机制决定，不承担遮盖把手的职责 */}
      <div className="vc-collapse__clip">
        <div className="vc-collapse__inner" style={{ width }}>
          {children}
        </div>
      </div>

      {/* 把手裁剪窗口：贴在侧栏右缘，宽度=露出宽度，overflow hidden 把胶囊左半裁掉 */}
      <div className="vc-collapse__handle" style={{ top: HANDLE_TOP }}>
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label={collapsed ? '展开侧栏' : '收起侧栏'}
          title={collapsed ? '展开侧栏' : '收起侧栏'}
          style={{ left: -HANDLE_VISIBLE, width: HANDLE_FULL, paddingLeft: HANDLE_VISIBLE + 1 }}
        >
          <Icon icon={collapsed ? chevronRightIcon : chevronLeftIcon} width={14} />
        </button>
      </div>
    </div>
  );
};

export default CollapsibleSidebar;
