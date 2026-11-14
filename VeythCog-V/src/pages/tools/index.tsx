import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { Input } from 'antd';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/states/EmptyState';
import { tools, groupToolsByCategory } from './registry';
import { storage } from '@/utils/storage';
import searchIcon from '@iconify-icons/lucide/search';
import starIcon from '@iconify-icons/lucide/star';
import puzzleIcon from '@iconify-icons/lucide/puzzle';

const FAV_KEY = 'tools:favorites';

const ToolsHome: React.FC = () => {
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

  const noResult = Boolean(q) && groups.length === 0 && favTools.length === 0;

  const renderCard = (tool: (typeof tools)[number]) => {
    const isFav = favSet.has(tool.id);
    return (
      <div
        key={tool.id}
        className="vc-card vc-card--interactive vc-tool-card"
        role="button"
        tabIndex={0}
        onClick={() => navigate(`/tools/${tool.id}`)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') navigate(`/tools/${tool.id}`);
        }}
      >
        <button
          type="button"
          className={`vc-tool-card__star${isFav ? ' is-on' : ''}`}
          title={isFav ? '取消收藏' : '收藏'}
          onClick={(e) => {
            e.stopPropagation();
            toggleFav(tool.id);
          }}
        >
          <Icon icon={starIcon} width={16} />
        </button>

        <div className="vc-tool-card__icon">{tool.icon}</div>
        <div className="vc-tool-card__name">{tool.name}</div>
        <div className="vc-tool-card__desc">{tool.description}</div>
      </div>
    );
  };

  return (
    <div className="vc-page">
      <div className="vc-page__body vc-page__body--wide">
        <PageHeader
          eyebrow="Workspace / Tools"
          title="开发工具集"
          description="常用前端/后端开发工具，全部本地运行，不上传数据。"
          extra={
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              prefix={<Icon icon={searchIcon} width={14} />}
              placeholder="搜索工具名称…"
              allowClear
              style={{ width: 260 }}
            />
          }
        />

        <div className="vc-stack vc-stack--loose">
          {!q && favTools.length > 0 && (
            <section>
              <div className="vc-section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon icon={starIcon} width={14} style={{ color: 'var(--color-warning)' }} />
                收藏
              </div>
              <div className="vc-grid">{favTools.map(renderCard)}</div>
            </section>
          )}

          {noResult ? (
            <EmptyState
              icon={puzzleIcon}
              title={`没有匹配 “${query}” 的工具`}
              description="换个关键词试试，或清空搜索查看全部工具。"
            />
          ) : (
            groups.map((g) => (
              <section key={g.category}>
                <div className="vc-section-title">{g.category}</div>
                <div className="vc-grid">{g.items.map(renderCard)}</div>
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ToolsHome;
