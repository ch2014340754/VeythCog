import { useEffect, useState } from 'react';

/**
 * 响应式媒体查询 Hook：跟随窗口宽度变化返回是否命中断点。
 * 初始值在 SSR/无 window 环境下回退 false，浏览器内立即按当前值初始化。
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

export default useMediaQuery;
