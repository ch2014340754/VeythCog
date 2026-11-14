import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface UseInfiniteRowsOptions {
  /** 每次追加的条数，默认 20 */
  pageSize?: number;
  /** 提前量，默认提前 240px 触发 */
  rootMargin?: string;
}

export interface UseInfiniteRowsResult<T> {
  /** 当前应渲染的行 */
  visible: T[];
  /** 是否还有未加载的行 */
  hasMore: boolean;
  /** 总行数 */
  total: number;
  /** 挂到底部哨兵上的 ref 回调 */
  sentinelRef: (node: HTMLElement | null) => void;
}

const SCROLLABLE = /(auto|scroll|overlay)/;

/** 向上查找最近的可滚动祖先，找不到返回 null（视口） */
function findScrollRoot(node: HTMLElement): HTMLElement | null {
  let el = node.parentElement;
  while (el && el !== document.body && el !== document.documentElement) {
    const style = window.getComputedStyle(el);
    if (SCROLLABLE.test(style.overflowY) && el.scrollHeight > el.clientHeight + 1) {
      return el;
    }
    el = el.parentElement;
  }
  return null;
}

function marginOf(rootMargin: string): number {
  const first = parseFloat(rootMargin.split(/\s+/)[0] ?? '0');
  return Number.isFinite(first) ? Math.abs(first) : 0;
}

/**
 * 列表下滑懒加载：不做分页，按页累积渲染，滚到底部附近自动补一页。
 * - 行数变化（筛选、刷新）时重置为第一页；
 * - 监听页面与内部滚动容器的 scroll（捕获阶段可收到容器滚动），不依赖 IntersectionObserver；
 * - 补页后哨兵仍在可视范围内（首屏没填满）会继续补页，直到填满或取完。
 */
export function useInfiniteRows<T>(
  rows: T[],
  options: UseInfiniteRowsOptions = {},
): UseInfiniteRowsResult<T> {
  const { pageSize = 20, rootMargin = '240px 0px' } = options;
  const [limit, setLimit] = useState(pageSize);

  const total = rows.length;
  const totalRef = useRef(total);
  totalRef.current = total;
  const limitRef = useRef(limit);
  limitRef.current = limit;
  const pageSizeRef = useRef(pageSize);
  pageSizeRef.current = pageSize;
  const marginRef = useRef(0);
  marginRef.current = marginOf(rootMargin);

  const nodeRef = useRef<HTMLElement | null>(null);
  const frameRef = useRef(0);

  const advance = useCallback(() => {
    if (limitRef.current >= totalRef.current) return false;
    const next = Math.min(limitRef.current + pageSizeRef.current, totalRef.current);
    limitRef.current = next;
    setLimit(next);
    return true;
  }, []);

  const check = useCallback(() => {
    const node = nodeRef.current;
    if (!node || !node.isConnected) return;
    if (limitRef.current >= totalRef.current) return;
    const margin = marginRef.current;
    const host = findScrollRoot(node);
    const boxTop = host ? host.getBoundingClientRect().top : 0;
    const boxBottom = host ? host.getBoundingClientRect().bottom : window.innerHeight;
    const rect = node.getBoundingClientRect();
    if (rect.top > boxBottom + margin || rect.bottom < boxTop - margin) return;
    advance();
  }, [advance]);

  const scheduleCheck = useCallback(() => {
    if (frameRef.current) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = 0;
      check();
    });
  }, [check]);

  useEffect(() => {
    window.addEventListener('scroll', scheduleCheck, true);
    window.addEventListener('resize', scheduleCheck);
    return () => {
      window.removeEventListener('scroll', scheduleCheck, true);
      window.removeEventListener('resize', scheduleCheck);
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
    };
  }, [scheduleCheck]);

  useEffect(() => {
    setLimit(pageSize);
    limitRef.current = pageSize;
  }, [total, pageSize]);

  useEffect(() => {
    scheduleCheck();
  }, [limit, scheduleCheck]);

  const sentinelRef = useCallback(
    (node: HTMLElement | null) => {
      nodeRef.current = node;
      if (node) scheduleCheck();
    },
    [scheduleCheck],
  );

  const visible = useMemo(() => rows.slice(0, limit), [rows, limit]);

  return { visible, hasMore: limit < total, total, sentinelRef };
}

export default useInfiniteRows;
