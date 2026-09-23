import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useTheme } from '@/contexts/ThemeContext';
import { groupToolsByCategory } from './registry';

const ToolsHome: React.FC = () => {
  const { colors } = useTheme();
  const navigate = useNavigate();
  const groups = groupToolsByCategory();

  return (
    <div style={{ padding: 32, maxWidth: 1200, margin: '0 auto', height: '100%', overflowY: 'auto' }}>
      <h1 style={{ fontSize: 24, margin: '0 0 8px' }}>开发工具集</h1>
      <p style={{ color: colors.textSecondary, margin: '0 0 32px', fontSize: 14 }}>
        常用前端/后端开发工具，全部本地运行，不上传数据。
      </p>

      {groups.map((g) => (
        <div key={g.category} style={{ marginBottom: 32 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: colors.textTertiary,
              letterSpacing: 1,
              marginBottom: 12,
            }}
          >
            {g.category}
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: 12,
            }}
          >
            {g.items.map((tool) => (
              <div
                key={tool.id}
                onClick={() => navigate(`/tools/${tool.id}`)}
                style={{
                  padding: 16,
                  borderRadius: 'var(--radius-lg)',
                  background: colors.surface,
                  border: `1px solid ${colors.border}`,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = colors.primary30;
                  (e.currentTarget as HTMLDivElement).style.background = colors.primary10;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = colors.border;
                  (e.currentTarget as HTMLDivElement).style.background = colors.surface;
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 'var(--radius-md)',
                    background: colors.primary10,
                    color: colors.primary,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 10,
                  }}
                >
                  {tool.icon}
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{tool.name}</div>
                <div style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 1.5 }}>
                  {tool.description}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default ToolsHome;
