import React from 'react';
import { useNavStore } from '@/stores/navStore';
import type { NavBookmark } from '@/api/nav';
import { useTheme } from '@/contexts/ThemeContext';
import BookmarkIcon from './BookmarkIcon';

interface Props {
  onAddBookmark?: () => void;
  onContextMenu?: (b: NavBookmark, e: React.MouseEvent) => void;
  /** 当前多选集合 */
  selectedIds?: number[];
  onSelectionChange?: (ids: number[]) => void;
  /** 开始拖动（右栏借此展开并进入可放置态） */
  onDragStartIds?: (ids: number[]) => void;
  onDragEnd?: () => void;
}

/** 书签网格最多展示 4 行，超出后容器内滚动 */
const ROW_HEIGHT = 100;
const ROW_GAP = 12;
const MAX_VISIBLE_ROWS = 4;
const GRID_MAX_HEIGHT = ROW_HEIGHT * MAX_VISIBLE_ROWS + ROW_GAP * (MAX_VISIBLE_ROWS - 1);

interface BandBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * 书签网格：滚轮切分类由 Home 页面统一接管。
 * 版式（宽度/行列/固定 4 行高度）由 .vc-bookmark-grid-wrap / .vc-bookmark-grid 提供。
 * 编辑/删除不放在图标上，统一走右键菜单（Home 页全局菜单），图标保持干净。
 *
 * 多选：在网格空白处按下并拖出一个选框，松手即选中与之相交的图标；
 * 空白处单击（没拖出框）清空选择。按住 Ctrl / Cmd / Shift 点单个图标也能加选。
 */
const BookmarkGrid: React.FC<Props> = ({
  onAddBookmark,
  onContextMenu,
  selectedIds = [],
  onSelectionChange,
  onDragStartIds,
  onDragEnd,
}) => {
  const bookmarks = useNavStore((s) => s.bookmarks);
  const activeCategoryId = useNavStore((s) => s.activeCategoryId);
  const { isDark } = useTheme();
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const [band, setBand] = React.useState<BandBox | null>(null);
  const startRef = React.useRef<{ x: number; y: number } | null>(null);

  // 切分类后回到顶部，避免把上一分类的滚动位置带过来
  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [activeCategoryId]);

  /** 空白处按住左键 → 拉框选；松手结算 */
  const handleBandStart = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const el = e.target as HTMLElement;
    // 落在图标 / 添加卡片 / 滚动条上时不拦，交给它们自己的行为
    if (el.closest('.vc-bookmark, .vc-bookmark__add')) return;
    const wrap = wrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const ox = e.clientX - rect.left;
    const oy = e.clientY - rect.top;
    startRef.current = { x: ox, y: oy };
    setBand({ x: ox, y: oy, w: 0, h: 0 });

    const onMove = (ev: MouseEvent) => {
      const cx = ev.clientX - rect.left;
      const cy = ev.clientY - rect.top;
      setBand({
        x: Math.min(ox, cx),
        y: Math.min(oy, cy),
        w: Math.abs(cx - ox),
        h: Math.abs(cy - oy),
      });
    };

    const onUp = (ev: MouseEvent) => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      const start = startRef.current;
      startRef.current = null;
      setBand(null);
      if (!start) return;

      const cx = ev.clientX - rect.left;
      const cy = ev.clientY - rect.top;
      // 没拖出框 = 空白单击 → 清空选择
      if (Math.abs(cx - start.x) < 4 && Math.abs(cy - start.y) < 4) {
        onSelectionChange?.([]);
        return;
      }

      const box = {
        left: Math.min(start.x, cx),
        top: Math.min(start.y, cy),
        right: Math.max(start.x, cx),
        bottom: Math.max(start.y, cy),
      };
      const hits: number[] = [];
      wrap.querySelectorAll<HTMLElement>('.vc-bookmark').forEach((node) => {
        const r = node.getBoundingClientRect();
        const nodeBox = {
          left: r.left - rect.left,
          top: r.top - rect.top,
          right: r.left - rect.left + r.width,
          bottom: r.top - rect.top + r.height,
        };
        const intersects =
          nodeBox.left < box.right &&
          nodeBox.right > box.left &&
          nodeBox.top < box.bottom &&
          nodeBox.bottom > box.top;
        if (!intersects) return;
        const id = Number(node.dataset.bookmarkId);
        if (!Number.isNaN(id)) hits.push(id);
      });
      onSelectionChange?.(hits);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const toggleSelect = (id: number) => {
    const next = selectedIds.includes(id)
      ? selectedIds.filter((x) => x !== id)
      : [...selectedIds, id];
    onSelectionChange?.(next);
  };

  return (
    <div ref={wrapRef} className="vc-bookmark-grid-wrap" onMouseDown={handleBandStart}>
      <div
        ref={scrollRef}
        className={`vc-bookmark-grid nav-bookmark-scroll ${isDark ? 'is-dark' : 'is-light'}`}
      >
        {bookmarks.map((b) => (
          <BookmarkIcon
            key={b.id}
            bookmark={b}
            onContextMenu={onContextMenu}
            selected={selectedIds.includes(b.id)}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onDragStartIds={onDragStartIds}
            onDragEnd={onDragEnd}
          />
        ))}
        {/* 添加图标卡片 */}
        <button type="button" className="vc-bookmark__add" onClick={onAddBookmark}>
          <span className="vc-bookmark__add-plus">+</span>
          <span className="vc-bookmark__add-text">添加图标</span>
        </button>
      </div>
      {band && (
        <div
          className="vc-bookmark-band"
          style={{ left: band.x, top: band.y, width: band.w, height: band.h }}
        />
      )}
    </div>
  );
};

export default BookmarkGrid;
