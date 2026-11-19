import React from 'react';
import { Icon } from '@iconify/react';
import plusIcon from '@iconify-icons/lucide/plus';
import searchIcon from '@iconify-icons/lucide/search';
import calendarIcon from '@iconify-icons/lucide/calendar';
import chevronLeftIcon from '@iconify-icons/lucide/chevron-left';
import chevronRightIcon from '@iconify-icons/lucide/chevron-right';
import layoutGridIcon from '@iconify-icons/lucide/layout-grid';
import listIcon from '@iconify-icons/lucide/list';
import pencilIcon from '@iconify-icons/lucide/pencil';
import trashIcon from '@iconify-icons/lucide/trash-2';
import xIcon from '@iconify-icons/lucide/x';
import { message } from 'antd';
import {
  createTodo,
  createTodoList,
  deleteTodo,
  deleteTodoList,
  listTodoLists,
  listTodos,
  renameTodoList,
  toggleTodo,
  updateTodo,
  type TodoItem,
  type TodoListView,
} from '@/api/todo';
import TodoRow from '@/pages/Todo/TodoRow';
import '@/pages/Todo/todo.css';
import './homeTodoPanel.css';

/** 当前看的是哪一组：今天 / 所有 / 某个自定义列表 */
type Scope = { kind: 'today' } | { kind: 'all' } | { kind: 'list'; listId: number };

const pad2 = (n: number) => String(n).padStart(2, '0');

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function todayKey(): string {
  return fmtDate(new Date());
}

function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** 日期按钮上的短文案：今天 / 明天 / 昨天 / 11-20 / 不设日期 */
function dueLabelText(key: string): string {
  if (!key) return '不设日期';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = parseKey(key);
  const diff = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return '今天';
  if (diff === 1) return '明天';
  if (diff === -1) return '昨天';
  return `${target.getMonth() + 1}-${target.getDate()}`;
}

function todayLabel(): string {
  const d = new Date();
  const weekday = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} 星期${weekday}`;
}

/** 轻量内联日历：Mon-first 六行格，不引弹层组件免得被面板 overflow 裁掉 */
const MiniCalendar: React.FC<{ value: string; onPick: (v: string | null) => void }> = ({
  value,
  onPick,
}) => {
  const base = value ? parseKey(value) : new Date();
  const [cursor, setCursor] = React.useState({ y: base.getFullYear(), m: base.getMonth() });

  const cells = React.useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1);
    const offset = (first.getDay() + 6) % 7;
    return Array.from({ length: 42 }, (_, i) =>
      new Date(cursor.y, cursor.m, 1 - offset + i),
    );
  }, [cursor]);

  const today = todayKey();

  return (
    <div className="vc-cal" role="dialog" aria-label="选择截止日">
      <div className="vc-cal__head">
        <button
          type="button"
          aria-label="上个月"
          onClick={() => setCursor((c) => (c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 }))}
        >
          <Icon icon={chevronLeftIcon} width={14} />
        </button>
        <span>
          {cursor.y} 年 {cursor.m + 1} 月
        </span>
        <button
          type="button"
          aria-label="下个月"
          onClick={() => setCursor((c) => (c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 }))}
        >
          <Icon icon={chevronRightIcon} width={14} />
        </button>
      </div>

      <div className="vc-cal__week">
        {['一', '二', '三', '四', '五', '六', '日'].map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>

      <div className="vc-cal__grid">
        {cells.map((d) => {
          const key = fmtDate(d);
          const out = d.getMonth() !== cursor.m;
          return (
            <button
              key={key}
              type="button"
              className={
                'vc-cal__day' +
                (out ? ' is-out' : '') +
                (key === value ? ' is-selected' : '') +
                (key === today ? ' is-today' : '')
              }
              onClick={() => onPick(key)}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>

      <div className="vc-cal__foot">
        <button type="button" onClick={() => onPick(today)}>
          今天
        </button>
        <button type="button" onClick={() => onPick(null)}>
          不设日期
        </button>
      </div>
    </div>
  );
};

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * 首页底部工具条里的待办浮窗（拟态窗口形态）。
 *
 * 结构照 Things/TickTick：左栏「搜索 + 今天 + 所有 + 自定义列表 + 新建列表」，
 * 主区「列表标题 + 添加任务条（含日期）+ 行内列表 + 空状态」。
 * 配色全部走主题变量，不写死颜色；变更后静默重取，旧列表留在原位。
 */
const HomeTodoPanel: React.FC<Props> = ({ open, onClose }) => {
  const [scope, setScope] = React.useState<Scope>({ kind: 'today' });
  const [keyword, setKeyword] = React.useState('');

  const [rows, setRows] = React.useState<TodoItem[]>([]);
  const [lists, setLists] = React.useState<TodoListView[]>([]);
  const [coldLoading, setColdLoading] = React.useState(true);

  const [draft, setDraft] = React.useState('');
  const [due, setDue] = React.useState<string>(todayKey());
  const [calOpen, setCalOpen] = React.useState(false);
  const [adding, setAdding] = React.useState(false);
  const [busyId, setBusyId] = React.useState<number | null>(null);

  /** 双击标题后进入行内重命名的行 id */
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const cancelledRef = React.useRef(false);

  /** 左栏列表的改名 / 新建 */
  const [renamingListId, setRenamingListId] = React.useState<number | null>(null);
  const [creatingList, setCreatingList] = React.useState(false);
  const [listDraft, setListDraft] = React.useState('');

  const seqRef = React.useRef(0);
  const panelRef = React.useRef<HTMLDivElement | null>(null);

  const load = React.useCallback(async () => {
    const seq = ++seqRef.current;
    try {
      const [page, listRows] = await Promise.all([
        listTodos({ status: 'all', current: 1, pageSize: 200 }),
        listTodoLists(),
      ]);
      if (seq !== seqRef.current) return;
      setRows(page.records);
      setLists(listRows);
    } catch {
      // 静默：保留现有内容，下次打开再取
    } finally {
      if (seq === seqRef.current) setColdLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!open) return;
    // 每次打开都把新任务的日期复位为今天（默认当日），避免带上一次的选择
    setDue(todayKey());
    void load();
  }, [open, load]);

  /** 正在看的列表被删掉时回退到「所有」 */
  React.useEffect(() => {
    if (scope.kind === 'list' && lists.length > 0 && !lists.some((l) => l.id === scope.listId)) {
      setScope({ kind: 'all' });
    }
  }, [lists, scope]);

  /** Esc 关闭：捕获阶段，避免被页面其他弹窗的 Esc 处理先吞掉 */
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  /** 日历点外部收起 */
  React.useEffect(() => {
    if (!calOpen) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest('.vc-cal')) return;
      if (target && target.closest('.vc-todopanel__date')) return;
      setCalOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [calOpen]);

  const today = todayKey();

  /** 当前分组 + 搜索词 → 列表；未完成在前，再按截止日、优先级 */
  const scoped = React.useMemo(() => {
    let base: TodoItem[];
    if (scope.kind === 'today') {
      base = rows.filter((r) => r.dueDate !== null && r.dueDate <= today);
    } else if (scope.kind === 'list') {
      base = rows.filter((r) => r.listId === scope.listId);
    } else {
      base = rows;
    }
    const kw = keyword.trim().toLowerCase();
    const filtered = kw
      ? base.filter(
          (r) =>
            r.title.toLowerCase().includes(kw) || (r.note ?? '').toLowerCase().includes(kw),
        )
      : base;
    return [...filtered].sort((a, b) => {
      if (a.status !== b.status) return a.status === 'done' ? 1 : -1;
      const ad = a.dueDate ?? '9999-99-99';
      const bd = b.dueDate ?? '9999-99-99';
      if (ad !== bd) return ad < bd ? -1 : 1;
      return b.priority - a.priority;
    });
  }, [rows, scope, keyword, today]);

  const todayOpenCount = React.useMemo(
    () => rows.filter((r) => r.status === 'open' && r.dueDate !== null && r.dueDate <= today).length,
    [rows, today],
  );
  const allOpenCount = React.useMemo(() => rows.filter((r) => r.status === 'open').length, [rows]);

  const scopeTitle =
    scope.kind === 'today'
      ? '今天'
      : scope.kind === 'all'
        ? '所有'
        : lists.find((l) => l.id === scope.listId)?.name ?? '列表';

  const submit = async () => {
    const title = draft.trim();
    if (!title || adding) return;
    setAdding(true);
    try {
      await createTodo({
        title,
        dueDate: due || null,
        listId: scope.kind === 'list' ? scope.listId : null,
      });
      setDraft('');
      await load();
    } catch {
      message.error('添加失败，请稍后再试');
    } finally {
      setAdding(false);
    }
  };

  /** 乐观切换：先改本地行，失败再回取 */
  const handleToggle = async (item: TodoItem) => {
    const nextStatus = item.status === 'open' ? 'done' : 'open';
    setBusyId(item.id);
    setRows((prev) =>
      prev.map((row) =>
        row.id === item.id
          ? { ...row, status: nextStatus, completedAt: nextStatus === 'done' ? Date.now() : null }
          : row,
      ),
    );
    try {
      const next = await toggleTodo(item.id);
      setRows((prev) => prev.map((row) => (row.id === item.id ? next : row)));
    } catch {
      message.error('操作失败');
      void load();
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (item: TodoItem) => {
    setRows((prev) => prev.filter((row) => row.id !== item.id));
    try {
      await deleteTodo(item.id);
      await load();
    } catch {
      message.error('删除失败');
      void load();
    }
  };

  /** 双击标题后按 Enter / 失焦保存；Esc 取消 */
  const commitRename = async (item: TodoItem, raw: string) => {
    if (cancelledRef.current) {
      cancelledRef.current = false;
      setEditingId(null);
      return;
    }
    const title = raw.trim();
    setEditingId(null);
    if (!title || title === item.title) return;
    try {
      await updateTodo(item.id, { title });
      setRows((prev) => prev.map((row) => (row.id === item.id ? { ...row, title } : row)));
    } catch {
      message.error('重命名失败');
      void load();
    }
  };

  const createList = async () => {
    const name = listDraft.trim();
    if (!name) {
      setCreatingList(false);
      setListDraft('');
      return;
    }
    try {
      const id = await createTodoList(name);
      setListDraft('');
      setCreatingList(false);
      await load();
      setScope({ kind: 'list', listId: id });
    } catch {
      message.error('新建列表失败');
    }
  };

  const commitListRename = async (list: TodoListView, raw: string) => {
    if (cancelledRef.current) {
      cancelledRef.current = false;
      setRenamingListId(null);
      return;
    }
    const name = raw.trim();
    setRenamingListId(null);
    if (!name || name === list.name) return;
    try {
      await renameTodoList(list.id, name);
      await load();
    } catch {
      message.error('重命名失败');
    }
  };

  const removeList = async (list: TodoListView) => {
    try {
      await deleteTodoList(list.id);
      if (scope.kind === 'list' && scope.listId === list.id) setScope({ kind: 'all' });
      await load();
    } catch {
      message.error('删除列表失败');
    }
  };

  if (!open) return null;

  const emptyText = keyword.trim()
    ? '没有匹配的任务'
    : scope.kind === 'today'
      ? '今天还没有安排，添加一条吧'
      : scope.kind === 'list'
        ? '这个列表还是空的，添加一条吧'
        : '赶快添加您的待办吧';

  return (
    <div
      className="vc-todopanel__backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div className="vc-todopanel" role="dialog" aria-modal="true" aria-label="待办" ref={panelRef}>
        <aside className="vc-todopanel__side">
          <div className="vc-todopanel__search">
            <Icon icon={searchIcon} width={15} />
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索"
              aria-label="搜索待办"
            />
          </div>

          <button
            type="button"
            className={'vc-todopanel__nav' + (scope.kind === 'today' ? ' is-active' : '')}
            onClick={() => setScope({ kind: 'today' })}
            aria-pressed={scope.kind === 'today'}
          >
            <span className="vc-todopanel__nav-ic" aria-hidden>
              <Icon icon={calendarIcon} width={15} />
            </span>
            <span className="vc-todopanel__nav-label">今天</span>
            <span className="vc-todopanel__nav-count">{todayOpenCount}</span>
          </button>

          <button
            type="button"
            className={'vc-todopanel__nav' + (scope.kind === 'all' ? ' is-active' : '')}
            onClick={() => setScope({ kind: 'all' })}
            aria-pressed={scope.kind === 'all'}
          >
            <span className="vc-todopanel__nav-ic" aria-hidden>
              <Icon icon={layoutGridIcon} width={15} />
            </span>
            <span className="vc-todopanel__nav-label">所有</span>
            <span className="vc-todopanel__nav-count">{allOpenCount}</span>
          </button>

          <div className="vc-todopanel__nav-sep" />

          <div className="vc-todopanel__lists">
            {lists.map((list) => (
              <div
                key={list.id}
                className={
                  'vc-todopanel__listitem' +
                  (scope.kind === 'list' && scope.listId === list.id ? ' is-active' : '')
                }
              >
                {renamingListId === list.id ? (
                  <input
                    className="vc-todopanel__listinput"
                    autoFocus
                    defaultValue={list.name}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur();
                      if (e.key === 'Escape') {
                        cancelledRef.current = true;
                        setRenamingListId(null);
                      }
                    }}
                    onBlur={(e) => void commitListRename(list, e.currentTarget.value)}
                  />
                ) : (
                  <button
                    type="button"
                    className="vc-todopanel__listbtn"
                    onClick={() => setScope({ kind: 'list', listId: list.id })}
                    title={list.name}
                  >
                    <span className="vc-todopanel__nav-ic" aria-hidden>
                      <Icon icon={listIcon} width={15} />
                    </span>
                    <span className="vc-todopanel__nav-label">{list.name}</span>
                    <span className="vc-todopanel__nav-count">{list.openCount}</span>
                  </button>
                )}

                {renamingListId !== list.id && (
                  <span className="vc-todopanel__listacts">
                    <button
                      type="button"
                      title="重命名列表"
                      aria-label="重命名列表"
                      onClick={() => setRenamingListId(list.id)}
                    >
                      <Icon icon={pencilIcon} width={13} />
                    </button>
                    <button
                      type="button"
                      title="删除列表"
                      aria-label="删除列表"
                      onClick={() => void removeList(list)}
                    >
                      <Icon icon={trashIcon} width={13} />
                    </button>
                  </span>
                )}
              </div>
            ))}
          </div>

          {creatingList ? (
            <input
              className="vc-todopanel__listinput is-new"
              autoFocus
              placeholder="列表名，回车创建"
              value={listDraft}
              onChange={(e) => setListDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void createList();
                if (e.key === 'Escape') {
                  setCreatingList(false);
                  setListDraft('');
                }
              }}
              onBlur={() => void createList()}
            />
          ) : (
            <button type="button" className="vc-todopanel__newlist" onClick={() => setCreatingList(true)}>
              <Icon icon={plusIcon} width={14} />
              新建列表
            </button>
          )}
        </aside>

        <section className="vc-todopanel__main">
          <header className="vc-todopanel__head">
            <div className="vc-todopanel__titles">
              <h2 className="vc-todopanel__title">{scopeTitle}</h2>
              <span className="vc-todopanel__date-text">{todayLabel()}</span>
            </div>
            <button type="button" className="vc-todopanel__close" onClick={onClose} aria-label="关闭">
              <Icon icon={xIcon} width={16} />
            </button>
          </header>

          <div className="vc-todopanel__add">
            <Icon icon={plusIcon} width={16} />
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submit();
              }}
              placeholder="添加任务，回车保存"
              aria-label="添加任务"
            />

            <div className="vc-todopanel__date">
              <button
                type="button"
                className={'vc-todopanel__datebtn' + (due ? ' is-on' : '')}
                onClick={() => setCalOpen((v) => !v)}
                title="选择截止日"
                aria-expanded={calOpen}
              >
                <Icon icon={calendarIcon} width={15} />
                <span>{dueLabelText(due)}</span>
              </button>

              {calOpen && (
                <MiniCalendar
                  value={due}
                  onPick={(v) => {
                    setDue(v ?? '');
                    setCalOpen(false);
                  }}
                />
              )}
            </div>
          </div>

          <div className={'vc-todopanel__rows' + (coldLoading ? ' is-loading' : '')}>
            {coldLoading && rows.length === 0 ? (
              <div className="vc-todopanel__loading">载入中…</div>
            ) : scoped.length === 0 ? (
              <div className="vc-todopanel__empty">
                <div className="vc-todopanel__empty-art" aria-hidden>
                  <div className="vc-todopanel__empty-box" />
                  <div className="vc-todopanel__empty-lid" />
                  <div className="vc-todopanel__empty-shadow" />
                </div>
                <p className="vc-todopanel__empty-text">{emptyText}</p>
              </div>
            ) : (
              scoped.map((item) =>
                editingId === item.id ? (
                  <div key={item.id} className="vc-todopanel__rename">
                    <input
                      autoFocus
                      defaultValue={item.title}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.currentTarget.blur();
                        if (e.key === 'Escape') {
                          cancelledRef.current = true;
                          setEditingId(null);
                        }
                      }}
                      onBlur={(e) => void commitRename(item, e.currentTarget.value)}
                    />
                  </div>
                ) : (
                  <TodoRow
                    key={item.id}
                    item={item}
                    busy={busyId === item.id}
                    onToggle={handleToggle}
                    onDelete={handleDelete}
                    onTitleDoubleClick={() => setEditingId(item.id)}
                  />
                ),
              )
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default HomeTodoPanel;
