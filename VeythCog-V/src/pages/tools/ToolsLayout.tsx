import React, { Suspense, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Icon } from '@iconify/react';
import arrowLeftIcon from '@iconify-icons/lucide/arrow-left';
import closeIcon from '@iconify-icons/lucide/x';
import { groupToolsByCategory, tools } from './registry';
import ToolsHome from './index';
import { Spin } from 'antd';

interface OpenTab {
  id: string;
  name: string;
}

const ToolsLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const groups = groupToolsByCategory();

  // 当前打开的工具 tab
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([]);

  // 从路径解析当前 toolId
  const currentToolId = location.pathname.startsWith('/tools/')
    ? location.pathname.split('/')[2]
    : null;

  // 切到某个工具时自动加 tab
  useEffect(() => {
    if (!currentToolId) return;
    const tool = tools.find((t) => t.id === currentToolId);
    if (tool && !openTabs.find((t) => t.id === currentToolId)) {
      setOpenTabs((prev) => [...prev, { id: tool.id, name: tool.name }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentToolId]);

  const closeTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const idx = openTabs.findIndex((t) => t.id === id);
    const newTabs = openTabs.filter((t) => t.id !== id);
    setOpenTabs(newTabs);
    if (id === currentToolId) {
      // 关的是当前 tab，切到右边或左边
      const next = newTabs[idx] || newTabs[idx - 1];
      navigate(next ? `/tools/${next.id}` : '/tools');
    }
  };

  return (
    <div className="vc-subnav-layout">
      {/* 二级侧栏 */}
      <aside className="vc-subnav vc-tools-nav">
        <div className="vc-tools-head">
          <button type="button" className="vc-backlink" onClick={() => navigate('/chat')}>
            <Icon icon={arrowLeftIcon} width={14} />
            返回工作区
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
                    onClick={(e) => closeTab(tab.id, e)}
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
