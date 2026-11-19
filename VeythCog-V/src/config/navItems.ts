import bookOpenIcon from '@iconify-icons/lucide/book-open';
import inboxIcon from '@iconify-icons/lucide/inbox';
import messageSquareIcon from '@iconify-icons/lucide/message-square';
import musicIcon from '@iconify-icons/lucide/music';
import wrenchIcon from '@iconify-icons/lucide/wrench';

/** 左侧导航项：icon 为 @iconify-icons 的图标数据 */
export interface NavItem {
  path: string;
  icon: typeof bookOpenIcon;
  label: string;
  /** 需要角标的入口：clipPending = 收件箱待处理条数 */
  badge?: 'clipPending';
}

/**
 * 全站主入口清单（唯一权威）。
 *
 * MainLayout 的固定 rail 与 Home 页的滑入式 rail 是两套布局、两个组件，
 * 但入口清单必须一致 —— 共用这一份，新增页面只改这里，避免只加一处造成"某个页面看不到入口"。
 *
 * 待办不在此列：它走首页底部工具条里的拟态浮窗（HomeTodoPanel），
 * 不占左侧导航的入口位。
 */
export const NAV_ITEMS: NavItem[] = [
  { path: '/chat', icon: messageSquareIcon, label: '对话' },
  { path: '/knowledge', icon: bookOpenIcon, label: '知识库' },
  { path: '/inbox', icon: inboxIcon, label: '收件箱', badge: 'clipPending' },
  { path: '/music', icon: musicIcon, label: '音乐库' },
  { path: '/tools', icon: wrenchIcon, label: '工具集' },
];
