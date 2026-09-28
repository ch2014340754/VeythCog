import React, { Suspense, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Icon } from '@iconify/react';
import arrowLeftIcon from '@iconify-icons/lucide/arrow-left';
import closeIcon from '@iconify-icons/lucide/x';
import { useTheme } from '@/contexts/ThemeContext';
import { groupToolsByCategory, tools } from './registry';
import ToolsHome from './index';
import { Spin } from 'antd';

const TOOLS_SIDEBAR_WIDTH = 260;

interface OpenTab {
  id: string;
  name: string;
}

const ToolsLayout: React.FC = () => {
  const { colors } = useTheme();
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

  const goHome = () => navigate('/tools');

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* 二级侧栏 */}
      <div
        style={{
          width: TOOLS_SIDEBAR_WIDTH,
          height: '100%',
          borderRight: `1px solid ${colors.divider}`,
          background: colors.surface,
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
        }}
      >
        <div style={{ padding: '16px 16px 8px' }}>
          <div
            onClick={() => navigate('/chat')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              color: colors.textSecondary,
              fontSize: 13,
              marginBottom: 12,
            }}
          >
            <Icon icon={arrowLeftIcon} width={14} />
            返回工作区
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-heading)' }}>
            开发工具集
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px 16px' }}>
          {groups.map((g) => (
            <div key={g.category} style={{ marginBottom: 8 }}>
              <div
                style={{
                  padding: '8px 12px 4px',
                  fontSize: 11,
                  fontWeight: 600,
                  color: colors.textTertiary,
                  letterSpacing: 1,
                }}
              >
                {g.category}
              </div>
              {g.items.map((tool) => {
                const path = `/tools/${tool.id}`;
                const active = location.pathname === path;
                return (
                  <div
                    key={tool.id}
                    onClick={() => navigate(path)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      background: active ? colors.primary10 : 'transparent',
                      color: active ? colors.primary : colors.text,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      fontSize: 13,
                      marginBottom: 2,
                      transition: 'background 0.15s',
                    }}
                  >
                    <span style={{ flexShrink: 0, opacity: active ? 1 : 0.7, display: 'inline-flex' }}>{tool.icon}</span>
                    {tool.name}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* 右侧：tab 栏 + 内容区 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        {/* 标签栏 */}
        {openTabs.length > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '6px 8px 0',
              borderBottom: `1px solid ${colors.divider}`,
              background: colors.surface,
              overflowX: 'auto',
              flexShrink: 0,
              height: 41
            }}
          >
            {openTabs.map((tab) => {
              const active = tab.id === currentToolId;
              return (
                <div
                  key={tab.id}
                  onClick={() => navigate(`/tools/${tab.id}`)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 10px',
                    borderRadius: '8px 8px 0 0',
                    cursor: 'pointer',
                    background: 'transparent',
                    color: active ? colors.primary : colors.textSecondary,
                    fontSize: 12,
                    whiteSpace: 'nowrap',
                    borderBottom: active ? `2px solid ${colors.primary}` : '2px solid transparent',
                    marginBottom: -1,
                  }}
                >
                  {tab.name}
                  <span
                    onClick={(e) => closeTab(tab.id, e)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 16,
                      height: 16,
                      borderRadius: 4,
                      cursor: 'pointer',
                      opacity: active ? 1 : 0.5,
                    }}
                  >
                    <Icon icon={closeIcon} width={12} />
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* 内容区：所有打开的工具都挂载，非激活隐藏，保留 state。overflow hidden 由工具内部自管滚动。
            背景透明，让 body 上的壁纸透出（与 Chat / Knowledge 页保持一致） */}
        <div style={{ flex: 1, overflow: 'hidden', background: 'transparent', position: 'relative' }}>
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
