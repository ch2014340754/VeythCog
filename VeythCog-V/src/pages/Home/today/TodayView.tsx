import arrowRightIcon from '@iconify-icons/lucide/arrow-right';
import bookOpenIcon from '@iconify-icons/lucide/book-open';
import calendarCheckIcon from '@iconify-icons/lucide/calendar-check';
import inboxIcon from '@iconify-icons/lucide/inbox';
import messageSquareIcon from '@iconify-icons/lucide/message-square';
import plusIcon from '@iconify-icons/lucide/plus';
import sparklesIcon from '@iconify-icons/lucide/sparkles';
import { Icon } from '@iconify/react';
import { Input, message } from 'antd';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { createTodo } from '@/api/todo';
import { useAuthStore } from '@/stores/authStore';
import useWorkbenchOverview from '@/hooks/useWorkbenchOverview';
import TodoRow from '@/pages/Todo/TodoRow';
import { toggleTodo } from '@/api/todo';
import './homeToday.css';

function greeting(now: Date): string {
  const h = now.getHours();
  if (h < 6) return '夜深了';
  if (h < 11) return '早上好';
  if (h < 14) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
}

function dateText(now: Date): string {
  const week = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][now.getDay()];
  return `${now.getFullYear()} 年 ${now.getMonth() + 1} 月 ${now.getDate()} 日 · ${week}`;
}

/** 相对时间：刚刚 / x 分钟前 / x 小时前 / 昨天 / 月-日 */
function relative(ms: number): string {
  if (!ms) return '';
  const diff = Date.now() - ms;
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  if (diff < 172_800_000) return '昨天';
  const d = new Date(ms);
  return `${d.getMonth() + 1}-${d.getDate()}`;
}

/**
 * 首页「今日」视图：问候 + 四个数字 + 我的待办（可内联新增）+ 最近文档 / 对话。
 *
 * 数据来自 /workbench/overview 一次聚合；首屏读 sessionStorage 缓存直接渲染，
 * 打开页面即静默刷新一次，失败保留旧内容（只在角标上提示）。
 */
const TodayView: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { data, loading, error, refresh } = useWorkbenchOverview();

  const [draft, setDraft] = React.useState('');
  const [adding, setAdding] = React.useState(false);
  const [busyId, setBusyId] = React.useState<number | null>(null);

  const now = new Date();
  const stats = data?.stats;
  const todos = data?.todos ?? [];

  const handleAdd = async () => {
    const title = draft.trim();
    if (!title || adding) return;
    setAdding(true);
    try {
      await createTodo({ title, priority: 1 });
      setDraft('');
      await refresh();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '添加失败');
    } finally {
      setAdding(false);
    }
  };

  const handleToggle = async (id: number, status: 'open' | 'done') => {
    setBusyId(id);
    try {
      await toggleTodo(id);
      await refresh();
    } catch {
      message.error('操作失败');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="vc-today">
      <div className="vc-today__inner">
        <header className="vc-today__hero">
          <div className="vc-today__greet">
            {greeting(now)}，{user?.name || '你好'}
          </div>
          <div className="vc-today__date">
            {dateText(now)}
            {error && <span className="vc-today__stale">· 数据更新失败，显示的是上次结果</span>}
          </div>
        </header>

        <div className="vc-today__stats">
          <div className="vc-today-stat" onClick={() => navigate('/todo')} role="button" tabIndex={0}>
            <span className="vc-today-stat__value">{loading && !stats ? '–' : stats?.openTodos ?? 0}</span>
            <span className="vc-today-stat__label">未完成待办</span>
          </div>
          <div className="vc-today-stat" onClick={() => navigate('/todo')} role="button" tabIndex={0}>
            <span className="vc-today-stat__value">
              {loading && !stats ? '–' : stats?.todayDueTodos ?? 0}
            </span>
            <span className="vc-today-stat__label">今日到期</span>
          </div>
          <div className="vc-today-stat" onClick={() => navigate('/inbox?status=pending')} role="button" tabIndex={0}>
            <span className="vc-today-stat__value">
              {loading && !stats ? '–' : stats?.unreadClips ?? 0}
            </span>
            <span className="vc-today-stat__label">剪藏待处理</span>
          </div>
          <div className="vc-today-stat" onClick={() => navigate('/knowledge')} role="button" tabIndex={0}>
            <span className="vc-today-stat__value">
              {loading && !stats ? '–' : stats?.totalDocs ?? 0}
            </span>
            <span className="vc-today-stat__label">知识文档</span>
          </div>
        </div>

        {(data?.tasks?.length ?? 0) > 0 && (
          <div className="vc-today__tasks">
            {data!.tasks.map((task) => (
              <button
                key={task.key}
                type="button"
                className={`vc-today-task is-${task.tone}`}
                onClick={() => navigate(task.href)}
              >
                <span className="vc-today-task__dot" aria-hidden />
                {task.label}
                <Icon icon={arrowRightIcon} width={13} />
              </button>
            ))}
          </div>
        )}

        <div className="vc-today__grid">
          <section className="vc-today__card vc-today__card--todos">
            <div className="vc-today__card-head">
              <span className="vc-today__card-title">
                <Icon icon={calendarCheckIcon} width={15} /> 我的待办
              </span>
              <button type="button" className="vc-today__more" onClick={() => navigate('/todo')}>
                全部 <Icon icon={arrowRightIcon} width={12} />
              </button>
            </div>

            <div className="vc-today__todo-list">
              {todos.length === 0 && !loading ? (
                <div className="vc-today__blank">今天没有待办，先记一条？</div>
              ) : (
                todos.map((item) => (
                  <TodoRow
                    key={item.id}
                    compact
                    busy={busyId === item.id}
                    item={{
                      id: item.id,
                      title: item.title,
                      note: '',
                      status: 'open',
                      priority: item.priority,
                      dueDate: item.dueDate,
                      overdue: item.overdue,
                      linkUrl: null,
                      linkDocId: null,
                      createdAt: 0,
                      updatedAt: 0,
                      completedAt: null,
                    }}
                    onToggle={(row) => void handleToggle(row.id, row.status)}
                  />
                ))
              )}
            </div>

            <div className="vc-today__compose">
              <Icon icon={plusIcon} width={14} className="vc-today__compose-icon" />
              <Input
                variant="borderless"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onPressEnter={handleAdd}
                placeholder="添加一条待办，回车保存"
                disabled={adding}
              />
            </div>
          </section>

          <section className="vc-today__card">
            <div className="vc-today__card-head">
              <span className="vc-today__card-title">
                <Icon icon={bookOpenIcon} width={15} /> 最近文档
              </span>
              <button type="button" className="vc-today__more" onClick={() => navigate('/knowledge')}>
                知识库 <Icon icon={arrowRightIcon} width={12} />
              </button>
            </div>
            {(data?.recentDocs?.length ?? 0) === 0 ? (
              <div className="vc-today__blank">还没有文档</div>
            ) : (
              <ul className="vc-today__list">
                {data!.recentDocs.map((doc) => (
                  <li key={doc.id}>
                    <button
                      type="button"
                      className="vc-today__item"
                      onClick={() => navigate(`/knowledge?docId=${doc.id}`)}
                    >
                      <span className="vc-today__item-title">{doc.title}</span>
                      <span className="vc-today__item-meta">
                        {doc.folderPath} · {relative(doc.updatedAt)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="vc-today__card">
            <div className="vc-today__card-head">
              <span className="vc-today__card-title">
                <Icon icon={messageSquareIcon} width={15} /> 最近对话
              </span>
              <button type="button" className="vc-today__more" onClick={() => navigate('/chat')}>
                对话 <Icon icon={arrowRightIcon} width={12} />
              </button>
            </div>
            {(data?.recentConversations?.length ?? 0) === 0 ? (
              <div className="vc-today__blank">还没有对话记录</div>
            ) : (
              <ul className="vc-today__list">
                {data!.recentConversations.map((conv) => (
                  <li key={conv.id}>
                    <button
                      type="button"
                      className="vc-today__item"
                      onClick={() => navigate(`/chat?c=${encodeURIComponent(conv.id)}`)}
                    >
                      <span className="vc-today__item-title">{conv.title}</span>
                      <span className="vc-today__item-meta">
                        {conv.messageCount} 条 · {relative(conv.updatedAt)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {(data?.unreadClips?.length ?? 0) > 0 && (
            <section className="vc-today__card">
              <div className="vc-today__card-head">
                <span className="vc-today__card-title">
                  <Icon icon={inboxIcon} width={15} /> 待读剪藏
                </span>
                <button type="button" className="vc-today__more" onClick={() => navigate('/inbox?status=pending')}>
                  收件箱 <Icon icon={arrowRightIcon} width={12} />
                </button>
              </div>
              <ul className="vc-today__list">
                {data!.unreadClips.map((clip) => (
                  <li key={clip.id}>
                    <button
                      type="button"
                      className="vc-today__item"
                      onClick={() => navigate('/inbox?status=pending')}
                    >
                      <span className="vc-today__item-title">{clip.title}</span>
                      <span className="vc-today__item-meta">
                        {clip.site || '未知来源'} · {relative(clip.createdAt)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <footer className="vc-today__quick">
          <button type="button" className="vc-today__quick-btn" onClick={() => navigate('/chat')}>
            <Icon icon={sparklesIcon} width={16} />
            开始一次对话
          </button>
          <button type="button" className="vc-today__quick-btn" onClick={() => navigate('/todo')}>
            <Icon icon={calendarCheckIcon} width={16} />
            管理全部待办
          </button>
        </footer>
      </div>
    </div>
  );
};

export default TodayView;
