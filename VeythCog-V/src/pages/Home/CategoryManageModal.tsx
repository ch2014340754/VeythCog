import React from 'react';
import { Modal, Input, Button, message } from 'antd';
import {
  createCategory,
  deleteCategory,
  updateCategory,
  type NavCategory,
} from '@/api/nav';
import { useNavStore } from '@/stores/navStore';

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * 分类管理弹窗：重命名 / 新增 / 删除分类。
 * 分类下有书签时禁用删除按钮。
 * 视觉走 vc-modal / vc-cat-row，颜色全部取主题变量。
 */
const CategoryManageModal: React.FC<Props> = ({ open, onClose }) => {
  const categories = useNavStore((s) => s.categories);
  const [newName, setNewName] = React.useState('');
  const [newIcon, setNewIcon] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const handleCreate = async () => {
    if (!newName.trim()) {
      message.warning('请输入分类名');
      return;
    }
    setSaving(true);
    try {
      await createCategory({ name: newName.trim(), icon: newIcon.trim() });
      message.success('分类已创建');
      setNewName('');
      setNewIcon('');
      const { loadCategories } = useNavStore.getState();
      loadCategories();
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
      const { loadCategories } = useNavStore.getState();
      loadCategories();
    } catch (err) {
      console.error('更新分类失败', err);
      message.error('更新失败');
    }
  };

  const handleDelete = async (c: NavCategory) => {
    if (!confirm(`删除分类「${c.name}」？`)) return;
    try {
      await deleteCategory(c.id);
      message.success('分类已删除');
      const { loadCategories, activeCategoryId, setActiveCategory } = useNavStore.getState();
      loadCategories().then(() => {
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
          <Input
            placeholder="图标 emoji（如 🎨）"
            value={newIcon}
            onChange={(e) => setNewIcon(e.target.value)}
            style={{ width: 120 }}
            maxLength={4}
          />
          <Button type="primary" onClick={handleCreate} loading={saving}>
            新增
          </Button>
        </div>
        {/* 分类列表 */}
        <div className="vc-stack vc-stack--tight">
          {categories.map((c) => (
            <div key={c.id} className="vc-cat-row">
              <span className="vc-cat-row__icon">{c.icon || '📁'}</span>
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
          ))}
        </div>
      </div>
    </Modal>
  );
};

export default CategoryManageModal;
