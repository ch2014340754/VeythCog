import type { BlockNoteEditor } from '@blocknote/core';
import { CODE_BLOCK_LANGUAGES } from './codeBlockLanguages';

/** 代码块头部装饰所需的外部状态读写 */
export type CodeBlockDecorationOptions = {
  /** 该块当前是否处于收起状态 */
  isCollapsed: (blockId: string) => boolean;
  /** 切换收起状态，返回切换后的值 */
  toggleCollapsed: (blockId: string) => boolean;
  /** 该块是否开启了自动换行（默认不换行） */
  isWrapped: (blockId: string) => boolean;
  /** 切换自动换行，返回切换后的值 */
  toggleWrapped: (blockId: string) => boolean;
  /** 取代码块名称（空串表示未命名） */
  getTitle: (blockId: string) => string;
  /** 更新代码块名称 */
  setTitle: (blockId: string, title: string) => void;
};

const CHEVRON_SVG =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
  'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="m6 9 6 6 6-6"/></svg>';

const COPY_SVG =
  '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
  'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';

const CHECK_SVG =
  '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
  'stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M20 6 9 17l-5-5"/></svg>';

const CONTENT_SELECTOR = '.bn-block-content[data-content-type="codeBlock"]';

type CodeHead = {
  root: HTMLDivElement;
  collapse: HTMLButtonElement;
  title: HTMLInputElement;
  copy: HTMLButtonElement;
  wrap: HTMLButtonElement;
  select: HTMLSelectElement;
};

function blockIdOf(el: HTMLElement): string {
  return el.closest('[data-id]')?.getAttribute('data-id') ?? '';
}

/** 复制到剪贴板：优先 clipboard API，非安全上下文/无权限时退回 execCommand */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', 'true');
      area.style.position = 'fixed';
      area.style.top = '-9999px';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

function escapeId(id: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(id);
  return id.replace(/["\\]/g, '\\$&');
}

/**
 * 代码块头部（收起 / 名称 / 语言）浮层。
 *
 * 为什么不直接把控件塞进 BlockNote 的代码块节点视图：
 * 那部分 DOM 归 ProseMirror 管，任何外部插入（哪怕只是一个 data-* 属性）都会被它的
 * DOM 观察器当成外部改动，随后整棵节点视图重建，控件被清掉（实测插入即消失）。
 * 所以这里在编辑器外层放一层绝对定位的浮层，按块的位置贴上去，完全不动编辑器 DOM。
 */
export function mountCodeBlockOverlay(
  editor: BlockNoteEditor<any, any, any>,
  getHost: () => HTMLElement | null,
  options: CodeBlockDecorationOptions,
): () => void {
  let disposed = false;
  let host: HTMLElement | null = null;
  let layer: HTMLDivElement | null = null;
  let headLayerStyle: HTMLStyleElement | null = null;
  let observer: ResizeObserver | null = null;
  let attachedRoot: HTMLElement | null = null;
  let timer = 0;
  let retryTimer = 0;

  const heads = new Map<string, CodeHead>();

  const schedule = () => {
    if (disposed || timer) return;
    // 用宏任务合并同一轮的多次变更：rAF 在后台标签页/无头渲染里会被挂起
    timer = window.setTimeout(() => {
      timer = 0;
      layout();
    }, 0);
  };

  const applyBlockStyles = () => {
    if (!headLayerStyle) return;
    const root = editor.domElement;
    if (!root) return;
    const rules: string[] = [];
    root.querySelectorAll<HTMLElement>(CONTENT_SELECTOR).forEach((content) => {
      const id = blockIdOf(content);
      if (!id) return;
      const base = `.bn-block[data-id="${escapeId(id)}"] .bn-block-content[data-content-type="codeBlock"]`;
      if (options.isCollapsed(id)) {
        rules.push(`${base}>pre{display:none}`, `${base}{min-height:36px}`);
      }
      if (options.isWrapped(id)) {
        rules.push(
          `${base}>pre{white-space:pre-wrap;overflow-x:hidden;word-break:break-word;overflow-wrap:anywhere}`,
        );
      }
    });
    headLayerStyle.textContent = rules.join('');
    heads.forEach((head, id) => {
      const collapsed = options.isCollapsed(id);
      head.collapse.setAttribute('aria-expanded', String(!collapsed));
      head.collapse.title = collapsed ? '展开代码块' : '收起代码块';
      head.root.classList.toggle('is-collapsed', collapsed);

      const wrapped = options.isWrapped(id);
      head.wrap.setAttribute('aria-pressed', String(wrapped));
      head.wrap.title = wrapped ? '自动换行（点击关闭）' : '不换行（点击开启）';
    });
  };

  const createHead = (id: string): CodeHead => {
    const root = document.createElement('div');
    root.className = 'vc-code-head';
    root.dataset.blockId = id;

    const collapse = document.createElement('button');
    collapse.type = 'button';
    collapse.className = 'vc-code-collapse';
    collapse.innerHTML = CHEVRON_SVG;
    collapse.addEventListener('mousedown', (event) => event.preventDefault());
    collapse.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      options.toggleCollapsed(id);
      applyBlockStyles();
      schedule();
    });

    const title = document.createElement('input');
    title.className = 'vc-code-title';
    title.type = 'text';
    title.placeholder = '代码块名称';
    title.maxLength = 120;
    title.spellcheck = false;
    title.addEventListener('input', () => options.setTitle(id, title.value));
    title.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === 'Escape') {
        event.preventDefault();
        title.blur();
      }
    });

    const copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'vc-code-copy';
    copy.innerHTML = COPY_SVG;
    copy.title = '复制代码';
    copy.setAttribute('aria-label', '复制代码');
    copy.addEventListener('mousedown', (event) => event.preventDefault());
    let copyTimer = 0;
    copy.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const block = editor.getBlock(id);
      const text = ((block?.content ?? []) as Array<{ text?: string }>)
        .map((part) => part?.text ?? '')
        .join('');
      const ok = await copyText(text);
      copy.classList.toggle('is-copied', ok);
      copy.innerHTML = ok ? CHECK_SVG : COPY_SVG;
      copy.title = ok ? '已复制' : '复制失败';
      if (copyTimer) window.clearTimeout(copyTimer);
      copyTimer = window.setTimeout(() => {
        copy.classList.remove('is-copied');
        copy.innerHTML = COPY_SVG;
        copy.title = '复制代码';
      }, 1400);
    });

    const wrap = document.createElement('button');
    wrap.type = 'button';
    wrap.className = 'vc-code-wrap';
    wrap.textContent = '换行';
    wrap.setAttribute('aria-pressed', 'false');
    wrap.addEventListener('mousedown', (event) => event.preventDefault());
    wrap.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      options.toggleWrapped(id);
      applyBlockStyles();
      schedule();
    });

    const select = document.createElement('select');
    select.className = 'vc-code-lang';
    select.setAttribute('aria-label', '代码语言');
    Object.entries(CODE_BLOCK_LANGUAGES).forEach(([langId, meta]) => {
      const option = document.createElement('option');
      option.value = langId;
      option.textContent = meta.name;
      select.appendChild(option);
    });
    select.addEventListener('change', () => {
      const language = select.value;
      editor.updateBlock(id, { props: { language } } as any);
      schedule();
    });

    root.append(collapse, title, copy, wrap, select);
    layer?.appendChild(root);

    const head: CodeHead = { root, collapse, title, copy, wrap, select };
    heads.set(id, head);
    return head;
  };

  const attachResizeObserver = (root: HTMLElement) => {
    if (attachedRoot === root) return;
    attachedRoot = root;
    observer?.disconnect();
    observer = new ResizeObserver(() => schedule());
    observer.observe(root);
  };

  const layout = () => {
    if (disposed) return;
    if (!host) {
      host = getHost();
      if (!host) {
        retryTimer = window.setTimeout(schedule, 120);
        return;
      }
      layer = document.createElement('div');
      layer.className = 'vc-code-layer';
      host.appendChild(layer);
      headLayerStyle = document.createElement('style');
      headLayerStyle.dataset.vcCodeHead = '1';
      document.head.appendChild(headLayerStyle);
      // 滚动发生在编辑器自己的滚动容器里，scroll 不冒泡，用捕获兜住
      host.addEventListener('scroll', schedule, { capture: true, passive: true });
      window.addEventListener('resize', schedule);
    }

    const root = editor.domElement;
    if (!root) {
      retryTimer = window.setTimeout(schedule, 120);
      return;
    }
    attachResizeObserver(root);

    const hostRect = host.getBoundingClientRect();
    const seen = new Set<string>();

    root.querySelectorAll<HTMLElement>(CONTENT_SELECTOR).forEach((content) => {
      const id = blockIdOf(content);
      if (!id) return;
      seen.add(id);
      const head = heads.get(id) ?? createHead(id);
      const rect = content.getBoundingClientRect();
      head.root.style.width = `${Math.max(120, Math.round(rect.width - 12))}px`;
      head.root.style.transform = `translate(${Math.round(rect.left - hostRect.left + 6)}px, ${Math.round(
        rect.top - hostRect.top + 6,
      )}px)`;

      if (document.activeElement !== head.title) {
        const value = options.getTitle(id);
        if (head.title.value !== value) head.title.value = value;
      }

      const language = ((editor.getBlock(id)?.props ?? {}) as { language?: string }).language ?? 'text';
      if (head.select.value !== language) {
        if (!Array.from(head.select.options).some((option) => option.value === language)) {
          const option = document.createElement('option');
          option.value = language;
          option.textContent = language;
          head.select.appendChild(option);
        }
        head.select.value = language;
      }
    });

    heads.forEach((head, id) => {
      if (seen.has(id)) return;
      head.root.remove();
      heads.delete(id);
    });

    applyBlockStyles();
  };

  const unsubscribeChange = editor.onChange(() => schedule());
  layout();

  return () => {
    disposed = true;
    unsubscribeChange?.();
    if (timer) window.clearTimeout(timer);
    if (retryTimer) window.clearTimeout(retryTimer);
    observer?.disconnect();
    host?.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
    heads.forEach((head) => head.root.remove());
    heads.clear();
    layer?.remove();
    headLayerStyle?.remove();
  };
}
