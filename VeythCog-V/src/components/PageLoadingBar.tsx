import React from 'react';

/**
 * 页面加载条：路由 chunk 还没到位时露出的一条 2px 细进度条。
 *
 * 为什么不沿用原来那句"加载中…"的整屏占位：
 * 整屏占位会把外壳（左侧 rail + 玻璃内容卡）一起顶掉，观感就是"闪一下白"。
 * 这里只画一条线，且默认铺满内容区上沿，外壳保持不动。
 */
const PageLoadingBar: React.FC<{ docked?: boolean }> = ({ docked = false }) => (
  <div
    className={docked ? 'vc-page-loading vc-page-loading--docked' : 'vc-page-loading'}
    aria-busy="true"
    aria-live="polite"
  >
    <div className="vc-slim-progress">
      <div className="vc-slim-progress__bar" />
    </div>
  </div>
);

export default PageLoadingBar;
