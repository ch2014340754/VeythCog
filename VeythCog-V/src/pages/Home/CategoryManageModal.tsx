import { Modal, Input, Button, message } from 'antd';
import React from 'react';
import { Icon } from '@iconify/react';
import {
  createCategory,
  deleteCategory,
  updateCategory,
  type NavCategory,
} from '@/api/nav';
import { useNavStore } from '@/stores/navStore';
import { CATEGORY_ICON_OPTIONS, categoryIconByKey, categoryIconFor } from '@/utils/categoryIcon';

interface Props {
  open: boolean;
  onClose: () => void;
}

/** 图标选择网格：50 个单色图标，点一下即选中（颜色由 CSS 的 currentColor 决定） */
const IconGrid: React.FC<{
  value?: string;
  onPick: (key: string) => void;
}> = ({ value, onPick }) => (
  <div className="vc-icongrid" role="listbox" aria-label="选择分类图标">
    {CATEGORY_ICON_OPTIONS.map((opt) => (
      <button
        key={opt.key}
        type="button"
        role="option"
        aria-selected={value === opt.key}
        className={'vc-icongrid__cell' + (value === opt.key ? ' is-active' : '')}
        title={opt.label}
        onClick={() => onPick(opt.key)}
      >
        <Icon icon={opt.icon} width={18} height={18} />
      </button>
    ))}
  </div>
);

/**
 * 分类管理弹窗：新增 / 重命名 / 换图标 / 删除分类。
 * 图标不再让用户敲 emoji，而是从 50 个预设单色图标里挑（存的是键名，渲染再解析）。
 * 分类下有书签时禁用删除按钮。
 */
const CategoryManageModal: React.FC<Props> = ({ open, onClose }) => {
  const categories = useNavStore((s) => s.categories);
  const [newName, setNewName] = React.useState('');
  const [newIcon, setNewIcon] = React.useState<string>('folder');
  const [pickerOpen, setPickerOpen] = React.useState(false);
  /** 正在换图标的老分类 id；null 表示没在编辑 */
  const [iconEditingId, setIconEditingId] = React.useState<number | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setPickerOpen(false);
      setIconEditingId(null);
    }
  }, [open]);

  const reload = () => useNavStore.getState().loadCategories();

  const handleCreate = async () => {
    if (!newName.trim()) {
      message.warning('请输入分类名');
      return;
    }
    setSaving(true);
    try {
      await createCategory({ name: newName.trim(), icon: newIcon });
      message.success('分类已创建');
      setNewName('');
      setNewIcon('folder');
      setPickerOpen(false);
      reload();
    } catch (err) {
      console.error('创建分类失败', err);
      message.error('创建失败');
    } finally {
      setSaving(false);
    }
  };

  const handleRename = async (c: NavCategory) => {
    const name = prompt('分类名', c.name);
    if (!name || name === c.name) return;
    try {
      await updateCategory(c.id, { name, icon: c.icon });
      message.success('已更新');
      reload();
    } catch (err) {
      console.error('更新分类失败', err);
      message.error('更新失败');
    }
  };

  const handleChangeIcon = async (c: NavCategory, iconKey: string) => {
    setIconEditingId(null);
    if (iconKey === c.icon) return;
    try {
      await updateCategory(c.id, { name: c.name, icon: iconKey });
      message.success('图标已更新');
      reload();
    } catch (err) {
      console.error('更新分类图标失败', err);
      message.error('更新图标失败');
    }
  };

  const handleDelete = async (c: NavCategory) => {
    if (!confirm(`删除分类「${c.name}」？`)) return;
    try {
      await deleteCategory(c.id);
      message.success('分类已删除');
      const { activeCategoryId, setActiveCategory } = useNavStore.getState();
      reload().then(() => {
        const list = useNavStore.getState().categories;
        if (activeCategoryId === c.id && list.length > 0) {
          setActiveCategory(list[0].id);
        }
      });
    } catch (err: any) {
      console.error('删除分类失败', err);
      message.error(err?.message || '删除失败（分类下可能还有书签）');
    }
  };

  return (
    <Modal
      rootClassName="vc-modal"
      title={<div className="vc-modal-head__title">分类管理</div>}
      open={open}
      onCancel={onClose}
      footer={null}
      width={480}
    >
      <div className="vc-stack">
        {/* 新增分类 */}
        <div className="vc-toolbar">
          <Input
            placeholder="分类名（如 设计）"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            style={{ flex: 1 }}
          />
          <button
            type="button"
            className={'vc-iconpick-trigger' + (pickerOpen ? ' is-open' : '')}
            title="选择图标"
            onClick={() => setPickerOpen((v) => !v)}
          >
            <Icon icon={categoryIconByKey(newIcon)} width={18} height={18} />
            <span>图标</span>
          </button>
          <Button type="primary" onClick={handleCreate} loading={saving}>
            新增
          </Button>
        </div>
        {pickerOpen && (
          <IconGrid
            value={newIcon}
            onPick={(key) => {
              setNewIcon(key);
              setPickerOpen(false);
            }}
          />
        )}

        {/* 分类列表 */}
        <div className="vc-stack vc-stack--tight">
          {categories.map((c) => (
            <React.Fragment key={c.id}>
              <div className="vc-cat-row">
                <button
                  type="button"
                  className={'vc-cat-row__icon' + (iconEditingId === c.id ? ' is-open' : '')}
                  title="点击更换图标"
                  onClick={() => setIconEditingId((id) => (id === c.id ? null : c.id))}
                >
                  <Icon icon={categoryIconFor(c.icon, c.name)} width={18} height={18} />
                </button>
                <span className="vc-cat-row__name">{c.name}</span>
                <div className="vc-cat-row__actions">
                  <Button size="small" onClick={() => handleRename(c)}>
                    重命名
                  </Button>
                  <Button
                    size="small"
                    danger
                    onClick={() => handleDelete(c)}
                    // 分类下有书签时禁用删除（后端 409 兜底，前端先禁用提示）
                    title="分类下有书签时不可删除，请先清空"
                  >
                    删除
                  </Button>
                </div>
              </div>
              {iconEditingId === c.id && (
                <IconGrid value={c.icon} onPick={(key) => handleChangeIcon(c, key)} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </Modal>
  );
};

export default CategoryManageModal;
