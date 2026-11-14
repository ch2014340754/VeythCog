import React, { Suspense, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Icon } from '@iconify/react';
import arrowLeftIcon from '@iconify-icons/lucide/arrow-left';
import closeIcon from '@iconify-icons/lucide/x';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useToolTabsStore } from '@/stores/toolTabsStore';
import { groupToolsByCategory, tools } from './registry';
import ToolsHome from './index';
import { Spin } from 'antd';

const ToolsLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const groups = groupToolsByCategory();

  // 标签栏提到全局 store 持久化：刷新后多标签工作区不丢
  const tabs = useToolTabsStore((s) => s.tabs);
  const openTab = useToolTabsStore((s) => s.openTab);
  const closeTab = useToolTabsStore((s) => s.closeTab);

  // 从路径解析当前 toolId
  const currentToolId = location.pathname.startsWith('/tools/')
    ? location.pathname.split('/')[2]
    : null;
  const currentTool = currentToolId ? tools.find((t) => t.id === currentToolId) : undefined;

  useDocumentTitle(currentTool?.name ?? '工具集');

  // 切到某个工具时确保标签存在（顺序沿用打开顺序，不重排）
  useEffect(() => {
    if (!currentTool) return;
    openTab({ id: currentTool.id, name: currentTool.name, openedAt: Date.now() });
  }, [currentTool, openTab]);

  // registry 里已删除的 id 不渲染（store 由旧版本持久化时可能出现）
  const openTabs = tabs.filter((tab) => tools.some((t) => t.id === tab.id));

  const handleCloseTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const idx = openTabs.findIndex((t) => t.id === id);
    const next = openTabs[idx + 1] ?? openTabs[idx - 1];
    closeTab(id);
    if (id === currentToolId) {
      navigate(next ? `/tools/${next.id}` : '/tools');
    }
  };

  return (
    <div className="vc-subnav-layout">
      {/* 二级侧栏 */}
      <aside className="vc-subnav vc-tools-nav">
        <div className="vc-tools-head">
          <button type="button" className="vc-backlink" onClick={() => navigate('/home')}>
            <Icon icon={arrowLeftIcon} width={14} />
            返回首页
          </button>
          <div className="vc-eyebrow" style={{ margin: 0 }}>Workspace</div>
          <h2 className="vc-subnav__title" style={{ marginTop: 2 }}>开发工具集</h2>
        </div>

        <div className="vc-tools-nav__scroll">
          {groups.map((g) => (
            <div key={g.category} className="vc-tools-group">
              <div className="vc-tools-group__label">{g.category}</div>
              {g.items.map((tool) => {
                const path = `/tools/${tool.id}`;
                const active = location.pathname === path;
                return (
                  <div
                    key={tool.id}
                    className={`vc-subnav__item${active ? ' is-active' : ''}`}
                    onClick={() => navigate(path)}
                  >
                    <span style={{ display: 'inline-flex', flexShrink: 0, opacity: active ? 1 : 0.7 }}>
                      {tool.icon}
                    </span>
                    {tool.name}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </aside>

      {/* 右侧：tab 栏 + 内容区 */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        {/* 标签栏 */}
        {openTabs.length > 0 && (
          <div className="vc-tabbar">
            {openTabs.map((tab) => {
              const active = tab.id === currentToolId;
              return (
                <div
                  key={tab.id}
                  className={`vc-tab${active ? ' is-active' : ''}`}
                  onClick={() => navigate(`/tools/${tab.id}`)}
                >
                  {tab.name}
                  <button
                    type="button"
                    className="vc-tab__close"
                    title="关闭"
                    onClick={(e) => handleCloseTab(tab.id, e)}
                  >
                    <Icon icon={closeIcon} width={12} />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* 内容区：所有打开的工具都挂载，非激活隐藏，保留 state。overflow hidden 由工具内部自管滚动。
            背景透明，让 body 上的壁纸透出（与 Chat / Knowledge 页保持一致） */}
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', background: 'transparent', position: 'relative' }}>
          {!currentToolId && <ToolsHome />}
          <Suspense
            fallback={
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <Spin />
              </div>
            }
          >
            {openTabs.map((tab) => {
              const tool = tools.find((t) => t.id === tab.id);
              if (!tool) return null;
              const Comp = tool.component;
              return (
                <div
                  key={tab.id}
                  style={{
                    display: tab.id === currentToolId ? 'block' : 'none',
                    height: '100%',
                  }}
                >
                  <Comp />
                </div>
              );
            })}
          </Suspense>
        </div>
      </div>
    </div>
  );
};

export default ToolsLayout;
