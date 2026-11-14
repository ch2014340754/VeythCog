import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import arrowLeftIcon from '@iconify-icons/lucide/arrow-left';

export interface SectionNavItem {
  path: string;
  icon: Parameters<typeof Icon>[0]['icon'];
  label: string;
}

interface SectionNavProps {
  /** 侧栏归属标签（英文大写小标题） */
  eyebrow: string;
  /** 侧栏主标题 */
  title: string;
  items: SectionNavItem[];
  /** 侧栏底部说明 */
  foot?: React.ReactNode;
  /** 顶部返回入口的目标路径；不传则不渲染 */
  backTo?: string;
  /** 返回入口文案 */
  backLabel?: string;
}

/** 二级页面统一侧栏：设置 / 系统管理 / 工具集共用同一套尺寸与选中态 */
export const SectionNav: React.FC<SectionNavProps> = ({
  eyebrow,
  title,
  items,
  foot,
  backTo,
  backLabel,
}) => {
  const navigate = useNavigate();
  return (
    <aside className="vc-subnav">
      {backTo && (
        <div className="vc-subnav__back">
          <button type="button" className="vc-backlink" onClick={() => navigate(backTo)}>
            <Icon icon={arrowLeftIcon} width={14} />
            {backLabel ?? '返回首页'}
          </button>
        </div>
      )}
      <div className="vc-subnav__head">
        <div className="vc-subnav__eyebrow">{eyebrow}</div>
        <div className="vc-subnav__title">{title}</div>
      </div>
      {items.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) => `vc-subnav__item${isActive ? ' is-active' : ''}`}
        >
          <Icon icon={item.icon} width={16} />
          {item.label}
        </NavLink>
      ))}
      {foot && <div className="vc-subnav__foot">{foot}</div>}
    </aside>
  );
};

interface SubPageLayoutProps extends SectionNavProps {
  children?: React.ReactNode;
  /** 内容区最大宽度：设置类 960，管理表格类用 wide */
  wide?: boolean;
}

/** 二级页面骨架：左侧导航 + 右侧滚动内容（内容卡内单点滚动） */
export const SubPageLayout: React.FC<SubPageLayoutProps> = ({ children, wide, ...nav }) => (
  <div className="vc-subnav-layout">
    <SectionNav {...nav} />
    <main className="vc-subnav-content">
      <div className="vc-subnav-content__inner" style={wide ? { maxWidth: 1200 } : undefined}>
        {children ?? <Outlet />}
      </div>
    </main>
  </div>
);

export default SubPageLayout;
