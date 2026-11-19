/**
 * 首页「今日 / 导航」视图偏好。
 *
 * 双层存储：
 * - localStorage：首屏同步读取，保证切页回来时视图不闪；
 * - user_setting.home_view：跨设备同步，异步回写，失败不影响本地。
 *
 * 优先级：本机有记录就用本机（最后一次操作设备说了算），没有才采用服务端值。
 */
import { getUserSetting, updateUserSetting } from '@/api/user';

export type HomeView = 'today' | 'nav';

const KEY = 'vc:home:view';

/** 没有任何偏好记录时以导航视图为主 */
const DEFAULT_VIEW: HomeView = 'nav';

export function readHomeView(): HomeView {
  try {
    const saved = localStorage.getItem(KEY);
    return saved === 'today' || saved === 'nav' ? saved : DEFAULT_VIEW;
  } catch {
    return DEFAULT_VIEW;
  }
}

function hasLocal(): boolean {
  try {
    return localStorage.getItem(KEY) === 'today' || localStorage.getItem(KEY) === 'nav';
  } catch {
    return false;
  }
}

/** 本机无记录时，用服务端偏好兜底（新设备首次打开） */
export async function syncHomeViewFromServer(): Promise<HomeView | null> {
  if (hasLocal()) return null;
  try {
    const setting = await getUserSetting();
    const view: HomeView = setting.homeView === 'today' ? 'today' : DEFAULT_VIEW;
    localStorage.setItem(KEY, view);
    return view;
  } catch {
    return null;
  }
}

/** 用户切换视图：立即写本地（下一帧不再闪），后台静默同步服务端 */
export function persistHomeView(view: HomeView) {
  try {
    localStorage.setItem(KEY, view);
  } catch {
    // 隐私模式：只用内存态，刷新后回到默认
  }
  void updateUserSetting({ homeView: view }).catch(() => {
    // 同步失败不打扰用户：本机仍按新视图显示
  });
}
