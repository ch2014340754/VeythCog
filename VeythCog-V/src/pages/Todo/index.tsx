import plusIcon from '@iconify-icons/lucide/plus';
import searchIcon from '@iconify-icons/lucide/search';
import { Icon } from '@iconify/react';
import { Button, Input, Modal, message } from 'antd';
import React from 'react';
import { listTodos, deleteTodo, toggleTodo, type TodoItem, type TodoStatusFilter } from '@/api/todo';
import PageHeader from '@/components/PageHeader';
import ListSentinel from '@/components/ListSentinel';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import useInfiniteRows from '@/hooks/useInfiniteRows';
import TodoEditModal from './TodoEditModal';
import TodoRow from './TodoRow';
import './todo.css';

const FILTERS: Array<{ key: TodoStatusFilter; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'open', label: '未完成' },
  { key: 'done', label: '已完成' },
];

/**
 * 待办页：筛选 + 搜索 + 无限滚动列表 + 新增/编辑弹窗。
 *
 * 刷新策略：所有变更（增删改与切换筛选）都走静默刷新——旧内容留在原位、
 * 顶部只出一条细进度线，不出现整页 loading，也不闪。
 */
const TodoPage: React.FC = () => {
  useDocumentTitle('待办');

  const [filter, setFilter] = React.useState<TodoStatusFilter>('all');
  const [keyword, setKeyword] = React.useState('');
  const [debounced, setDebounced] = React.useState('');

  const [rows, setRows] = React.useState<TodoItem[]>([]);
  const [total, setTotal] = React.useState(0);
  const [coldLoading, setColdLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const [busyId, setBusyId] = React.useState<number | null>(null);

  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<TodoItem | null>(null);

  /** 丢弃过期响应：快速切筛选时后到的旧结果不能覆盖新结果 */
  const seqRef = React.useRef(0);

  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(keyword.trim()), 300);
    return () => clearTimeout(timer);
  }, [keyword]);

  const load = React.useCallback(
    async (silent: boolean) => {
      const seq = ++seqRef.current;
      if (!silent) setRefreshing(true);
      else setRefreshing(true);
      try {
        const page = await listTodos({ status: filter, keyword: debounced, current: 1, pageSize: 100 });
        if (seq !== seqRef.current) return;
        setRows(page.records);
        setTotal(page.total);
        setFailed(false);
      } catch {
        if (seq !== seqRef.current) return;
        setFailed(true);
      } finally {
        if (seq === seqRef.current) {
          setRefreshing(false);
          setColdLoading(false);
        }
      }
    },
    [filter, debounced],
  );

  React.useEffect(() => {
    void load(true);
  }, [load]);

  const { visible, hasMore, sentinelRef } = useInfiniteRows(rows, { pageSize: 20 });

  const openCreate = () => {
    setEditing(null);
    setEditorOpen(true);
  };

  const openEdit = (item: TodoItem) => {
    setEditing(item);
    setEditorOpen(true);
  };

  /** 乐观更新：先改本地行，失败再整体刷新回来 */
  const handleToggle = async (item: TodoItem) => {
    setBusyId(item.id);
    const optimisticStatus = item.status === 'open' ? 'done' : 'open';
    setRows((prev) =>
      prev.map((row) =>
        row.id === item.id
          ? {
              ...row,
              status: optimisticStatus,
              completedAt: optimisticStatus === 'done' ? Date.now() : null,
            }
          : row,
      ),
    );
    try {
      const next = await toggleTodo(item.id);
      setRows((prev) => prev.map((row) => (row.id === item.id ? next : row)));
    } catch {
      message.error('操作失败，已刷新列表');
      void load(true);
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = (item: TodoItem) => {
    Modal.confirm({
      title: '删除待办',
      content: `确定删除「${item.title}」？删除后不再出现在列表里。`,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteTodo(item.id);
          setRows((prev) => prev.filter((row) => row.id !== item.id));
          setTotal((prev) => Math.max(0, prev - 1));
        } catch {
          message.error('删除失败');
        }
      },
    });
  };

  const openCount = React.useMemo(() => rows.filter((r) => r.status === 'open').length, [rows]);

  return (
    <div className="vc-page vc-todo-page">
      <PageHeader
        eyebrow="TODOS"
        title="待办"
        description="随手记下要做的事，完成即勾掉；首页今日视图会带出最近 4 条。"
        extra={
          <Button type="primary" icon={<Icon icon={plusIcon} width={16} />} onClick={openCreate}>
            新增待办
          </Button>
        }
      />

      <div className="vc-todo-toolbar">
        <div className="vc-todo-pills">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={'vc-todo-pill' + (filter === f.key ? ' is-active' : '')}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Input
          allowClear
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          prefix={<Icon icon={searchIcon} width={14} />}
          placeholder="搜索标题或备注"
          className="vc-todo-search"
        />
      </div>

      <div className={'vc-todo-body' + (refreshing ? ' is-refreshing' : '')}>
        <div className="vc-todo-progress" aria-hidden />

        {coldLoading ? (
          <div className="vc-todo-skeleton" aria-label="加载中">
            {[0, 1, 2].map((i) => (
              <div key={i} className="vc-todo-skeleton-row" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="vc-todo-empty">
            <div className="vc-todo-empty__title">
              {failed ? '列表加载失败' : debounced ? '没有匹配的待办' : '还没有待办'}
            </div>
            <div className="vc-todo-empty__hint">
              {failed
                ? '网络或服务异常，稍后会自动重试。'
                : debounced
                  ? '换个关键词试试，或者清空搜索。'
                  : '把要做的事写下来，列表会自动按截止日与优先级排好。'}
            </div>
            {!debounced && !failed && (
              <Button onClick={openCreate}>写下第一条</Button>
            )}
          </div>
        ) : (
          <>
            <div className="vc-todo-count">
              {filter === 'all'
                ? `共 ${total} 条 · 未完成 ${openCount}`
                : `${FILTERS.find((f) => f.key === filter)?.label} ${total} 条`}
              {total > rows.length && ` · 仅显示最近 ${rows.length} 条`}
            </div>
            <div className="vc-todo-list">
              {visible.map((item) => (
                <TodoRow
                  key={item.id}
                  item={item}
                  busy={busyId === item.id}
                  onToggle={handleToggle}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
            <ListSentinel total={rows.length} shown={visible.length} hasMore={hasMore} sentinelRef={sentinelRef} />
          </>
        )}
      </div>

      <TodoEditModal
        open={editorOpen}
        editing={editing}
        onClose={() => setEditorOpen(false)}
        onSaved={() => void load(true)}
      />
    </div>
  );
};

export default TodoPage;
