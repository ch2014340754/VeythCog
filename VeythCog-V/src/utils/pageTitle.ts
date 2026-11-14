/**
 * 路由 → 浏览器标题（不含站点后缀）。
 * `/tools/:id` 返回 null：标题由 ToolsLayout 用工具名设置，避免父布局覆盖。
 */
const PAGE_TITLES: Record<string, string> = {
  '/home': '导航首页',
  '/chat': '对话',
  '/knowledge': '知识库',
  '/tools': '工具集',
  '/settings': '设置',
  '/settings/account': '账号设置',
  '/settings/providers': '模型配置',
  '/settings/lark': '飞书绑定',
  '/settings/appearance': '外观',
  '/admin': '系统管理',
  '/admin/users': '用户管理',
  '/admin/roles': '角色管理',
  '/admin/models': '模型目录',
  '/admin/monitor': '系统监控',
  '/admin/audit': '审计日志',
  '/admin/tasks': '定时任务',
  '/admin/config': '系统配置',
  '/login': '登录',
};

/** 去掉末尾斜杠（保留根路径） */
function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.replace(/\/+$/, '') || '/';
  }
  return pathname;
}

export function resolvePageTitle(pathname: string): string | null {
  const path = normalizePath(pathname);
  if (path.startsWith('/tools/')) return null;
  return PAGE_TITLES[path] ?? null;
}

export default resolvePageTitle;
