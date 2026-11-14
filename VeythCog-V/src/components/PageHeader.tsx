/**
 * 页面头部：eyebrow + 标题 + 描述 + 右侧操作区
 * 视觉规范见 docs/frontend-style-guide.md 第 4 节：H1 28/700、描述 13、eyebrow 11/0.2em。
 */
import React from 'react';

interface Props {
  title: string;
  description?: React.ReactNode;
  /** 小标题（英文/编号标签），用于页面归属说明 */
  eyebrow?: string;
  extra?: React.ReactNode;
  /**
   * 标题下方那条 3px 流光（默认开）。
   * 设成 false 就只剩标题与描述：设置类子页内容窄，短横线在那儿像多余的划线。
   */
  flow?: boolean;
}

const PageHeader: React.FC<Props> = ({ title, description, eyebrow, extra, flow = true }) => (
  <header className={`vc-page-head${flow ? '' : ' vc-page-head--no-flow'}`}>
    <div className="vc-page-head__main">
      {eyebrow && <div className="vc-eyebrow">{eyebrow}</div>}
      <h1 className="vc-title">{title}</h1>
      {description && <p className="vc-desc">{description}</p>}
    </div>
    {extra && <div className="vc-actions">{extra}</div>}
  </header>
);

export default PageHeader;
