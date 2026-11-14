/**
 * 路由页面的懒加载清单
 * ------------------------------------------------------------
 * 两处共用同一份清单：
 *   1. App.tsx 用 `React.lazy(PAGE_MODULES.chat)` 按需加载；
 *   2. 首屏渲染完成后（requestIdleCallback / 900ms 兜底）把剩下的 chunk 预取一遍。
 *
 * 为什么要预取：路由页面是 lazy 的，第一次点某个菜单时浏览器才去拉 chunk，
 * 那一刻 Suspense 会短暂顶掉内容区（观感就是"闪一下"）。预取之后，
 * 切页只剩 React 的同步渲染，肉眼看不到空档。
 */
export const PAGE_MODULES = {
  chat: () => import('@/pages/Chat'),
  knowledge: () => import('@/pages/Knowledge'),
  tools: () => import('@/pages/tools/ToolsLayout'),
  login: () => import('@/pages/Login'),
  settings: () => import('@/pages/Settings'),
  settingsAccount: () => import('@/pages/Settings/Account'),
  settingsProviders: () => import('@/pages/Settings/Providers'),
  settingsLark: () => import('@/pages/Settings/LarkBind'),
  settingsAppearance: () => import('@/pages/Settings/Appearance'),
  admin: () => import('@/pages/Admin'),
  adminUsers: () => import('@/pages/Admin/Users'),
  adminRoles: () => import('@/pages/Admin/Roles'),
  adminModels: () => import('@/pages/Admin/Models'),
  adminMonitor: () => import('@/pages/Admin/Monitoring'),
  adminAudit: () => import('@/pages/Admin/AuditLog'),
  adminTasks: () => import('@/pages/Admin/Tasks'),
  adminConfig: () => import('@/pages/Admin/Config'),
} as const;

type Loader = (typeof PAGE_MODULES)[keyof typeof PAGE_MODULES];

/** 预取全部路由 chunk；失败无所谓（真到那一步 react.lazy 还会再拉一次） */
export function preloadPages(): void {
  const loaders = Object.values(PAGE_MODULES) as Loader[];
  loaders.forEach((load) => {
    // 逐个触发，避免同一帧里十几条请求一起挤上去
    void load().catch(() => undefined);
  });
}

/**
 * 在首次渲染稳定之后再预取：优先 requestIdleCallback，
 * 不支持时退到 900ms 延时。只跑一次。
 */
export function schedulePreloadPages(): () => void {
  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    preloadPages();
  };

  const w = window as typeof window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };

  if (typeof w.requestIdleCallback === 'function') {
    const id = w.requestIdleCallback(run, { timeout: 2500 });
    return () => {
      done = true;
      w.cancelIdleCallback?.(id);
    };
  }

  const timer = window.setTimeout(run, 900);
  return () => {
    done = true;
    window.clearTimeout(timer);
  };
}
