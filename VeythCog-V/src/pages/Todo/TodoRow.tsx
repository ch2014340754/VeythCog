import checkIcon from '@iconify-icons/lucide/check';
import calendarIcon from '@iconify-icons/lucide/calendar';
import linkIcon from '@iconify-icons/lucide/link';
import pencilIcon from '@iconify-icons/lucide/pencil';
import trashIcon from '@iconify-icons/lucide/trash-2';
import { Icon } from '@iconify/react';
import React from 'react';
import type { TodoItem } from '@/api/todo';

interface Props {
  item: TodoItem;
  /** 紧凑模式（首页今日视图用）：不显示操作按钮 */
  compact?: boolean;
  /** 切换中：圆圈显示 loading 态，避免连点 */
  busy?: boolean;
  onToggle: (item: TodoItem) => void;
  onEdit?: (item: TodoItem) => void;
  onDelete?: (item: TodoItem) => void;
}

const PRIORITY_LABEL: Record<number, string> = { 0: '低', 1: '普通', 2: '高' };

/** 截止日文案：逾期 N 天 / 今天 / 明天 / 月-日 */
function describeDue(dueDate: string): { text: string; tone: 'normal' | 'soon' | 'overdue' } {
  const [y, m, d] = dueDate.split('-').map(Number);
  const due = new Date(y, (m || 1) - 1, d || 1);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (diff < 0) return { text: `逾期 ${-diff} 天`, tone: 'overdue' };
  if (diff === 0) return { text: '今天到期', tone: 'soon' };
  if (diff === 1) return { text: '明天', tone: 'soon' };
  if (diff <= 6) return { text: `${m}月${d}日`, tone: 'normal' };
  return { text: `${m}-${d}`, tone: 'normal' };
}

/**
 * 单条待办：勾选圆圈 + 标题 + 截止日 + 优先级点。
 * 未完成与已完成在同一行样式内切换（删除线 + 降透明度），不重排列表。
 */
const TodoRow: React.FC<Props> = ({ item, compact = false, busy = false, onToggle, onEdit, onDelete }) => {
  const done = item.status === 'done';
  const due = item.dueDate ? describeDue(item.dueDate) : null;
  const dueTone = item.overdue ? 'overdue' : due?.tone ?? 'normal';

  return (
    <div
      className={
        'vc-todo-row' + (done ? ' is-done' : '') + (compact ? ' is-compact' : '')
      }
    >
      <button
        type="button"
        className={'vc-todo-check' + (done ? ' is-done' : '') + (busy ? ' is-busy' : '')}
        onClick={() => onToggle(item)}
        disabled={busy}
        aria-pressed={done}
        aria-label={done ? '标记为未完成' : '标记为已完成'}
      >
        {done && <Icon icon={checkIcon} width={13} />}
      </button>

      <div className="vc-todo-main">
        <div className="vc-todo-title" title={item.title}>
          {item.title}
        </div>
        {(due || item.linkUrl || item.linkDocId) && (
          <div className="vc-todo-meta">
            {due && (
              <span className={`vc-todo-due is-${dueTone}`}>
                <Icon icon={calendarIcon} width={12} />
                {due.text}
              </span>
            )}
            {item.linkUrl && (
              <a
                className="vc-todo-link"
                href={item.linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                title={item.linkUrl}
              >
                <Icon icon={linkIcon} width={12} />
                链接
              </a>
            )}
            {item.linkDocId && !item.linkUrl && <span className="vc-todo-link">关联文档</span>}
          </div>
        )}
      </div>

      {item.priority > 0 && (
        <span
          className={`vc-todo-priority is-p${item.priority}`}
          title={`优先级：${PRIORITY_LABEL[item.priority] ?? '普通'}`}
          aria-label={`优先级${PRIORITY_LABEL[item.priority] ?? ''}`}
        />
      )}

      {!compact && (
        <div className="vc-todo-actions">
          {onEdit && (
            <button type="button" className="vc-todo-action" onClick={() => onEdit(item)} title="编辑">
              <Icon icon={pencilIcon} width={14} />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              className="vc-todo-action is-danger"
              onClick={() => onDelete(item)}
              title="删除"
            >
              <Icon icon={trashIcon} width={14} />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default TodoRow;
