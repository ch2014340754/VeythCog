import { http } from './client';

/** 工作台聚合视图（GET /workbench/overview） */
export interface WorkbenchStats {
  unreadClips: number;
  pendingVectorDocs: number;
  openTodos: number;
  todayDueTodos: number;
  totalDocs: number;
  totalBookmarks: number;
  totalConversations: number;
}

export interface WorkbenchTask {
  key: 'clip' | 'vectorize';
  label: string;
  count: number;
  href: string;
  tone: 'warn' | 'info';
}

export interface WorkbenchTodo {
  id: number;
  title: string;
  priority: number;
  dueDate: string | null;
  overdue: boolean;
}

export interface WorkbenchRecentDoc {
  id: number;
  title: string;
  summary: string;
  folderId: number | null;
  folderPath: string;
  isVectorized: boolean;
  updatedAt: number;
}

export interface WorkbenchUnreadClip {
  id: number;
  title: string;
  site: string;
  url: string;
  createdAt: number;
}

export interface WorkbenchConversation {
  id: string;
  title: string;
  modelName: string;
  messageCount: number;
  updatedAt: number;
}

export interface WorkbenchOverview {
  generatedAt: number;
  partial: boolean;
  stats: WorkbenchStats;
  tasks: WorkbenchTask[];
  todos: WorkbenchTodo[];
  recentDocs: WorkbenchRecentDoc[];
  unreadClips: WorkbenchUnreadClip[];
  recentConversations: WorkbenchConversation[];
}

export const fetchOverview = () => http.get<WorkbenchOverview>('/workbench/overview');
