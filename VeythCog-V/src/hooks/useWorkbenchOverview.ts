import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchOverview, type WorkbenchOverview } from '@/api/workbench';
import { useAuthStore } from '@/stores/authStore';

/**
 * 工作台聚合数据：缓存先渲染 + 静默刷新（不闪、不显示 loading）。
 *
 * - 首屏从 sessionStorage 读上次结果直接渲染（有缓存时 loading 恒为 false）
 * - 每次进页都重新拉一次，成功回写缓存；失败保留旧数据，只置 error
 * - 缓存按 userId 隔离，换账号不会串数据
 */
export interface UseWorkbenchResult {
  data: WorkbenchOverview | null;
  /** 仅在"没有任何可展示数据"时为 true（首屏冷启动） */
  loading: boolean;
  /** 最近一次刷新失败（旧数据仍在） */
  error: boolean;
  refresh: () => Promise<void>;
}

function cacheKey(): string {
  const uid = useAuthStore.getState().user?.id ?? 'anon';
  return `vc:workbench:overview:${uid}`;
}

function readCache(): WorkbenchOverview | null {
  try {
    const raw = sessionStorage.getItem(cacheKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WorkbenchOverview;
    return parsed && typeof parsed.generatedAt === 'number' ? parsed : null;
  } catch {
    return null;
  }
}

function writeCache(data: WorkbenchOverview) {
  try {
    sessionStorage.setItem(cacheKey(), JSON.stringify(data));
  } catch {
    // 配额满 / 隐私模式：忽略，不影响使用
  }
}

export function useWorkbenchOverview(): UseWorkbenchResult {
  const [data, setData] = useState<WorkbenchOverview | null>(() => readCache());
  const [loading, setLoading] = useState(() => data === null);
  const [error, setError] = useState(false);
  const aliveRef = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const next = await fetchOverview();
      if (!aliveRef.current) return;
      setData(next);
      writeCache(next);
      setError(false);
    } catch {
      if (!aliveRef.current) return;
      setError(true);
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    void refresh();
    return () => {
      aliveRef.current = false;
    };
  }, [refresh]);

  return { data, loading, error, refresh };
}

export default useWorkbenchOverview;
