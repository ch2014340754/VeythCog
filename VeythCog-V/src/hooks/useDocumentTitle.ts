import { useEffect } from 'react';

const BASE_TITLE = '渡思｜VeythCog';

/**
 * 声明式设置浏览器标签标题。
 * - 传字符串：`{title}｜渡思｜VeythCog`
 * - 传 null / undefined：不改动（父级布局用它让位给子级页面）
 */
export function useDocumentTitle(title?: string | null): void {
  useEffect(() => {
    if (!title) return;
    document.title = `${title}｜${BASE_TITLE}`;
  }, [title]);
}

export default useDocumentTitle;
