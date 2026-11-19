import React from 'react';
import { Icon } from '@iconify/react';
import plusIcon from '@iconify-icons/lucide/plus';
import { useNavStore } from '@/stores/navStore';
import { categoryIconFor } from '@/utils/categoryIcon';

interface Props {
  onAddCategory: () => void;
}

/**
 * 移动端首页分类条：把桌面右侧竖排分类栏改成顶部横向 chips。
 * 触屏没有 hover，分类必须直接可见、可点。
 */
const MobileCategoryBar: React.FC<Props> = ({ onAddCategory }) => {
  const categories = useNavStore((s) => s.categories);
  const activeCategoryId = useNavStore((s) => s.activeCategoryId);
  const setActiveCategory = useNavStore((s) => s.setActiveCategory);

  return (
    <div className="vc-home-cats">
      <div className="vc-home-cats__scroll">
        {categories.map((c) => {
          const active = c.id === activeCategoryId;
          return (
            <button
              key={c.id}
              type="button"
              className={`vc-home-cats__item${active ? ' is-active' : ''}`}
              onClick={() => setActiveCategory(c.id)}
              aria-pressed={active}
            >
              <Icon icon={categoryIconFor(c.icon, c.name)} width={16} />
              <span>{c.name}</span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className="vc-home-cats__add"
        onClick={onAddCategory}
        aria-label="新建分类"
      >
        <Icon icon={plusIcon} width={16} />
      </button>
    </div>
  );
};

export default MobileCategoryBar;
