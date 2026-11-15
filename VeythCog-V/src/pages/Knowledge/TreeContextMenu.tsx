import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface TreeMenuItem {
  key: string;
  label: string;
  danger?: boolean;
  icon?: React.ReactNode;
  onClick: () => void;
}

interface TreeContextMenuProps {
  /** 视口坐标（clientX / clientY） */
  x: number;
  y: number;
  items: TreeMenuItem[];
  onClose: () => void;
}

/**
 * 知识树右键菜单：玻璃浮层，跟随光标；贴边自动翻转；点外部 / Esc / 滚动即关闭。
 * 样式见 `./tree.css` 的 `.vc-tree-menu`。
 */
const TreeContextMenu: React.FC<TreeContextMenuProps> = ({ x, y, items, onClose }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });

  // 先渲染再测量，贴边时向左/向上翻转，避免溢出视口
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const left = x + rect.width > window.innerWidth - 8 ? Math.max(8, x - rect.width) : x;
    const top = y + rect.height > window.innerHeight - 8 ? Math.max(8, y - rect.height) : y;
    setPos({ left, top });
  }, [x, y]);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) {
        onClose();
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onScroll = () => onClose();

    document.addEventListener('mousedown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('mousedown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [onClose]);

  return (
    <div ref={ref} className="vc-tree-menu" style={{ left: pos.left, top: pos.top }} role="menu">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          role="menuitem"
          className={'vc-tree-menu__item' + (item.danger ? ' is-danger' : '')}
          onClick={() => {
            onClose();
            item.onClick();
          }}
        >
          {item.icon && <span className="vc-tree-menu__icon">{item.icon}</span>}
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
};

export default TreeContextMenu;
