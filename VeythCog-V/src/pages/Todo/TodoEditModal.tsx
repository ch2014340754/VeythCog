import { Button, Input, Modal, Select, message } from 'antd';
import React from 'react';
import { createTodo, updateTodo, type TodoItem, type TodoPatchPayload } from '@/api/todo';

interface Props {
  open: boolean;
  /** null = 新建 */
  editing: TodoItem | null;
  onClose: () => void;
  /** 保存成功（已落库）后回调，调用方负责静默刷新列表 */
  onSaved: () => void;
}

const PRIORITY_OPTIONS = [
  { value: 1, label: '普通' },
  { value: 2, label: '高' },
  { value: 0, label: '低' },
];

/**
 * 待办新建 / 编辑弹窗。
 * 编辑时"清空截止日/链接/备注"通过 clear 白名单提交，与后端 TodoPatchRequest 约定一致。
 */
const TodoEditModal: React.FC<Props> = ({ open, editing, onClose, onSaved }) => {
  const [title, setTitle] = React.useState('');
  const [note, setNote] = React.useState('');
  const [priority, setPriority] = React.useState(1);
  const [dueDate, setDueDate] = React.useState('');
  const [linkUrl, setLinkUrl] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setTitle(editing?.title ?? '');
    setNote(editing?.note ?? '');
    setPriority(editing?.priority ?? 1);
    setDueDate(editing?.dueDate ?? '');
    setLinkUrl(editing?.linkUrl ?? '');
  }, [open, editing]);

  const handleSubmit = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      message.warning('请填写待办标题');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const payload: TodoPatchPayload = {
          title: trimmed,
          priority,
          note: note.trim(),
        };
        const clear: NonNullable<TodoPatchPayload['clear']> = [];
        if (dueDate) payload.dueDate = dueDate;
        else if (editing.dueDate) clear.push('dueDate');

        if (linkUrl.trim()) payload.linkUrl = linkUrl.trim();
        else if (editing.linkUrl) clear.push('linkUrl');

        if (clear.length > 0) payload.clear = clear;
        await updateTodo(editing.id, payload);
      } else {
        await createTodo({
          title: trimmed,
          note: note.trim() || undefined,
          priority,
          dueDate: dueDate || null,
          linkUrl: linkUrl.trim() || null,
        });
      }
      message.success(editing ? '已保存' : '已添加');
      onSaved();
      onClose();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={editing ? '编辑待办' : '新增待办'}
      width={460}
      destroyOnClose
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button key="ok" type="primary" loading={saving} onClick={handleSubmit}>
          保存
        </Button>,
      ]}
    >
      <div className="vc-todo-form">
        <label className="vc-todo-field">
          <span>标题</span>
          <Input
            value={title}
            maxLength={255}
            placeholder="要做什么？"
            onChange={(e) => setTitle(e.target.value)}
            onPressEnter={handleSubmit}
            autoFocus
          />
        </label>

        <div className="vc-todo-field-row">
          <label className="vc-todo-field">
            <span>截止日</span>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </label>
          <label className="vc-todo-field">
            <span>优先级</span>
            <Select
              value={priority}
              options={PRIORITY_OPTIONS}
              onChange={setPriority}
              popupMatchSelectWidth={false}
            />
          </label>
        </div>

        <label className="vc-todo-field">
          <span>链接（可选）</span>
          <Input
            value={linkUrl}
            placeholder="https://..."
            onChange={(e) => setLinkUrl(e.target.value)}
          />
        </label>

        <label className="vc-todo-field">
          <span>备注</span>
          <Input.TextArea
            value={note}
            rows={3}
            placeholder="补充说明（可选）"
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
      </div>
    </Modal>
  );
};

export default TodoEditModal;
