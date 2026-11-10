import React from 'react';
import { Modal, Input, Button, message } from 'antd';
import { createBookmark, updateBookmark, type NavBookmark } from '@/api/nav';
import { useNavStore } from '@/stores/navStore';
import { useTheme } from '@/contexts/ThemeContext';

interface Props {
  open: boolean;
  onClose: () => void;
  /** 编辑模式：传入书签对象；新建模式：传 null */
  editing: NavBookmark | null;
}

/**
 * 添加/编辑书签弹窗（仿 iTab 风格，全局主题色）。
 * 图标由前端实时拼 favicon.ico，不在表单里做图标字段。
 */
const BookmarkModal: React.FC<Props> = ({ open, onClose, editing }) => {
  const activeCategoryId = useNavStore((s) => s.activeCategoryId);
  const { colors } = useTheme();
  const [title, setTitle] = React.useState('');
  const [url, setUrl] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  // 打开时初始化表单
  React.useEffect(() => {
    if (open) {
      setTitle(editing?.title || '');
      setUrl(editing?.url || '');
    }
  }, [open, editing]);

  const handleSave = async () => {
    if (!title.trim() || !url.trim()) {
      message.warning('请填写名称和 URL');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateBookmark(editing.id, { title: title.trim(), url: url.trim() });
      } else {
        if (!activeCategoryId) {
          message.error('请先选择分类');
          return;
        }
        await createBookmark({ categoryId: activeCategoryId, title: title.trim(), url: url.trim() });
      }
      message.success(editing ? '书签已更新' : '书签已添加');
      onClose();
      const { loadBookmarks, activeCategoryId: cid } = useNavStore.getState();
      if (cid) loadBookmarks(cid);
    } catch (err) {
      console.error('保存书签失败', err);
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={editing ? '编辑图标' : '添加图标'}
      open={open}
      onCancel={onClose}
      footer={null}
      width={480}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
        {/* 网址 */}
        <div>
          <div style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 6 }}>网址</div>
          <Input
            placeholder="https://"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            size="large"
            style={{ borderRadius: 10 }}
          />
        </div>

        {/* 名称 */}
        <div>
          <div style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 6 }}>名称</div>
          <Input
            placeholder="书签名称"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={64}
            size="large"
            style={{ borderRadius: 10 }}
          />
        </div>

        {/* 保存按钮 */}
        <Button
          type="primary"
          size="large"
          block
          loading={saving}
          onClick={handleSave}
          style={{
            borderRadius: 10,
            height: 44,
            fontWeight: 500,
          }}
        >
          保存
        </Button>
      </div>
    </Modal>
  );
};

export default BookmarkModal;
