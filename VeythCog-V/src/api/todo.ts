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

export interface TodoCreatePayload {
  title: string;
  note?: string;
  priority?: number;
  dueDate?: string | null;
  linkUrl?: string | null;
  linkDocId?: number | null;
}

/** 局部更新：只传要改的字段；清空字段写进 clear */
export interface TodoPatchPayload {
  title?: string;
  note?: string;
  priority?: number;
  dueDate?: string;
  linkUrl?: string;
  linkDocId?: number;
  clear?: Array<'dueDate' | 'linkUrl' | 'linkDocId' | 'note'>;
}

export type TodoStatusFilter = 'all' | 'open' | 'done';

export const listTodos = (params: {
  status?: TodoStatusFilter;
  keyword?: string;
  current?: number;
  pageSize?: number;
}) =>
  http.get<TodoPage>('/todo/items', {
    status: params.status ?? 'all',
    keyword: params.keyword || undefined,
    current: params.current ?? 1,
    pageSize: params.pageSize ?? 100,
  });

export const createTodo = (payload: TodoCreatePayload) => http.post<number>('/todo/items', payload);

export const updateTodo = (id: number, payload: TodoPatchPayload) =>
  http.put<void>(`/todo/items/${id}`, payload);

export const toggleTodo = (id: number) => http.post<TodoItem>(`/todo/items/${id}/toggle`);

export const deleteTodo = (id: number) => http.del<void>(`/todo/items/${id}`);
