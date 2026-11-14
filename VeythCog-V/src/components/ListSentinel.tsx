import React from 'react';

interface ListSentinelProps {
  /** 总条数 */
  total: number;
  /** 已渲染条数 */
  shown: number;
  /** 是否还有未加载数据 */
  hasMore: boolean;
  /** useInfiniteRows 返回的哨兵 ref */
  sentinelRef: (node: HTMLElement | null) => void;
}

/** 列表底部哨兵：进入视口即触发懒加载，同时作为「已全部加载」的提示 */
const ListSentinel: React.FC<ListSentinelProps> = ({ total, shown, hasMore, sentinelRef }) => (
  <div ref={sentinelRef} className="vc-list-sentinel" aria-live="polite">
    {hasMore
      ? `继续下滑加载 · 已显示 ${shown} / ${total}`
      : total > 0
        ? `已加载全部 ${total} 条`
        : '暂无数据'}
  </div>
);

export default ListSentinel;
