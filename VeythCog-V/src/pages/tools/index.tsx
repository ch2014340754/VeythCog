import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { Input } from 'antd';
import { useTheme } from '@/contexts/ThemeContext';
import { tools, groupToolsByCategory } from './registry';
import { storage } from '@/utils/storage';
import searchIcon from '@iconify-icons/lucide/search';
import starIcon from '@iconify-icons/lucide/star';

const FAV_KEY = 'tools:favorites';

const ToolsHome: React.FC = () => {
  const { colors } = useTheme();
  const navigate = useNavigate();
  const [favs, setFavs] = useState<string[]>(() => storage.get<string[]>(FAV_KEY) ?? []);
  const [query, setQuery] = useState('');

  const favSet = useMemo(() => new Set(favs), [favs]);

  const toggleFav = (id: string) => {
    setFavs((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      storage.set(FAV_KEY, next);
      return next;
    });
  };

  const q = query.trim().toLowerCase();
  const match = (name: string, desc: string) =>
    !q || name.toLowerCase().includes(q) || desc.toLowerCase().includes(q);

  const favTools = tools.filter((t) => favSet.has(t.id) && match(t.name, t.description));
  const groups = groupToolsByCategory()
    .map((g) => ({ ...g, items: g.items.filter((t) => match(t.name, t.description)) }))
    .filter((g) => g.items.length > 0);

  const noResult = q && groups.length === 0 && favTools.length === 0;

  const renderCard = (tool: (typeof tools)[number]) => {
    const isFav = favSet.has(tool.id);
    return (
      <div
        key={tool.id}
        onClick={() => navigate(`/tools/${tool.id}`)}
        style={{
          position: 'relative',
          padding: 16,
          borderRadius: 'var(--radius-lg)',
          background: colors.surface,
          border: `1px solid ${colors.border}`,
          cursor: 'pointer',
          transition: 'all 0.15s',
          boxShadow: isFav ? `0 0 0 1px ${colors.primary}, 0 0 16px ${colors.primary30}` : undefined,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = colors.primary;
          (e.currentTarget as HTMLDivElement).style.background = colors.primary10;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = colors.border;
          (e.currentTarget as HTMLDivElement).style.background = colors.surface;
        }}
      >
        {/* 收藏星标 */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleFav(tool.id);
          }}
          title={isFav ? '取消收藏' : '收藏'}
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
            color: isFav ? '#f0a020' : colors.textTertiary,
            opacity: isFav ? 1 : 0.55,
          }}
        >
          <Icon icon={starIcon} width={16} />
        </button>

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
        <div style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 1.5 }}>{tool.description}</div>
      </div>
    );
  };

  return (
    <div style={{ padding: 32, maxWidth: 1200, margin: '0 auto', height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 24, margin: '0 0 8px' }}>开发工具集</h1>
          <p style={{ color: colors.textSecondary, margin: 0, fontSize: 14 }}>
            常用前端/后端开发工具，全部本地运行，不上传数据。
          </p>
        </div>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          prefix={<Icon icon={searchIcon} width={14} />}
          placeholder="搜索工具名称…"
          allowClear
          style={{ width: 260 }}
        />
      </div>

      {/* 收藏置顶 */}
      {!q && favTools.length > 0 && (
        <div style={{ marginTop: 28, marginBottom: 8 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: colors.textTertiary,
              letterSpacing: 1,
              marginBottom: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Icon icon={starIcon} width={14} color="#f0a020" />
            收藏
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
              gap: 12,
            }}
          >
            {favTools.map(renderCard)}
          </div>
        </div>
      )}

      {noResult ? (
        <div style={{ padding: '80px 0', textAlign: 'center', color: colors.textSecondary, fontSize: 14 }}>
          没有匹配 “{query}” 的工具
        </div>
      ) : (
        groups.map((g) => (
          <div key={g.category} style={{ marginTop: q ? 24 : 32 }}>
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
              {g.items.map(renderCard)}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default ToolsHome;
