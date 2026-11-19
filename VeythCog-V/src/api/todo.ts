import { http } from './client';

/** 待办行（与后端 TodoItemView 同构，时间为 ms） */
export interface TodoItem {
  id: number;
  title: string;
  note: string;
  status: 'open' | 'done';
  /** 0 低 / 1 普通 / 2 高 */
  priority: number;
  /** yyyy-MM-dd；null = 无截止日 */
  dueDate: string | null;
  overdue: boolean;
  linkUrl: string | null;
  linkDocId: number | null;
  /** 所属列表 id；null = 未归类 */
  listId: number | null;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
}

export interface TodoPage {
  records: TodoItem[];
  total: number;
  current: number;
  pageSize: number;
}

/** 待办列表（自定义分组），带未完成 / 已完成计数 */
export interface TodoListView {
  id: number;
  name: string;
  sortOrder: number;
  openCount: number;
  doneCount: number;
}

export interface TodoCreatePayload {
  title: string;
  note?: string;
  priority?: number;
  dueDate?: string | null;
  linkUrl?: string | null;
  linkDocId?: number | null;
  listId?: number | null;
}

/** 局部更新：只传要改的字段；清空字段写进 clear */
export interface TodoPatchPayload {
  title?: string;
  note?: string;
  priority?: number;
  dueDate?: string;
  linkUrl?: string;
  linkDocId?: number;
  listId?: number;
  clear?: Array<'dueDate' | 'linkUrl' | 'linkDocId' | 'note' | 'listId'>;
}

export type TodoStatusFilter = 'all' | 'open' | 'done';

export const listTodos = (params: {
  status?: TodoStatusFilter;
  keyword?: string;
  /** 限定某个列表；不传 = 全部 */
  listId?: number;
  current?: number;
  pageSize?: number;
}) =>
  http.get<TodoPage>('/todo/items', {
    status: params.status ?? 'all',
    keyword: params.keyword || undefined,
    listId: params.listId ?? undefined,
    current: params.current ?? 1,
    pageSize: params.pageSize ?? 100,
  });

export const createTodo = (payload: TodoCreatePayload) => http.post<number>('/todo/items', payload);

export const updateTodo = (id: number, payload: TodoPatchPayload) =>
  http.put<void>(`/todo/items/${id}`, payload);

export const toggleTodo = (id: number) => http.post<TodoItem>(`/todo/items/${id}/toggle`);

export const deleteTodo = (id: number) => http.del<void>(`/todo/items/${id}`);

/** 列表清单（含计数） */
export const listTodoLists = () => http.get<TodoListView[]>('/todo/lists');

export const createTodoList = (name: string) => http.post<number>('/todo/lists', { name });

export const renameTodoList = (id: number, name: string) =>
  http.put<void>(`/todo/lists/${id}`, { name });

export const deleteTodoList = (id: number) => http.del<void>(`/todo/lists/${id}`);
