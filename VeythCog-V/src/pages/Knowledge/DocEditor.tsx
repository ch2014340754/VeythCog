import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import type { PartialBlock } from '@blocknote/core';
import { zh } from '@blocknote/core/locales';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import { Icon } from '@iconify/react';
import listTreeIcon from '@iconify-icons/lucide/list-tree';
import { Tooltip } from 'antd';
import { useTheme } from '@/contexts/ThemeContext';
import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';
import './doc-editor.css';

export interface DocEditorHandle {
  /** 保存时拉取当前文档快照：blockData（权威块 JSON）+ markdownText（派生缓存） */
  snapshot: () => Promise<{ blockData: string; markdownText: string }>;
  /** 聚焦文档首个标题块（供顶部标题点击定位） */
  focusTitle: () => void;
}

interface DocEditorProps {
  docId: number;
  /** 权威源：BlockNote 块数组 JSON 字符串 */
  blockData: string;
  /** 兼容旧文档 / 导入文档的 Markdown（blockData 不可用时降级解析） */
  markdownText: string;
  /** 文档标题（首个 H1，缺省回退首个任意标题）变化时回调，用于顶部标题同步 */
  onTitleChange?: (title: string) => void;
}

interface OutlineItem {
  id: string;
  level: number;
  text: string;
}

/** 校验并解析 blockData：必须是带 id/type/props 的 BlockNote 块数组（后端旧版块结构无 props，会降级走 md） */
function parseBlockJson(raw: string): PartialBlock[] | null {
  if (!raw) return null;
  try {
    const arr: unknown = JSON.parse(raw);
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const ok = arr.every(
      (b) =>
        b !== null &&
        typeof b === 'object' &&
        typeof (b as { id?: unknown }).id === 'string' &&
        typeof (b as { type?: unknown }).type === 'string' &&
        typeof (b as { props?: unknown }).props === 'object',
    );
    return ok ? (arr as PartialBlock[]) : null;
  } catch {
    return null;
  }
}

/** 展平行内内容为纯文本（递归处理 link 等嵌套节点） */
function flattenInline(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((node) => {
      if (typeof node === 'string') return node;
      if (node && typeof node === 'object') {
        const n = node as { type?: string; text?: string; content?: unknown };
        if (n.type === 'text') return n.text ?? '';
        if (n.type === 'link') return flattenInline(n.content);
      }
      return '';
    })
    .join('');
}

/** 递归提取标题块，生成侧目录 */
function extractOutline(blocks: unknown): OutlineItem[] {
  const items: OutlineItem[] = [];
  const walk = (list: unknown) => {
    if (!Array.isArray(list)) return;
    for (const raw of list) {
      if (!raw || typeof raw !== 'object') continue;
      const b = raw as {
        id?: string;
        type?: string;
        props?: { level?: number };
        content?: unknown;
        children?: unknown;
      };
      if (b.type === 'heading' && b.id) {
        const text = flattenInline(b.content).trim();
        if (text) {
          items.push({ id: b.id, level: b.props?.level ?? 1, text });
        }
      }
      if (b.children) walk(b.children);
    }
  };
  walk(blocks);
  return items;
}

/** 文档标题 = 首个 H1，缺省回退首个任意级别标题 */
function extractTitle(blocks: unknown): string {
  const headings = extractOutline(blocks);
  const h1 = headings.find((h) => h.level === 1);
  return (h1 ?? headings[0])?.text ?? '';
}

const DocEditor = forwardRef<DocEditorHandle, DocEditorProps>(function DocEditor(
  { docId, blockData, markdownText, onTitleChange },
  ref,
) {
  const { isDark } = useTheme();
  const editor = useCreateBlockNote({ dictionary: zh });
  const scrollRef = useRef<HTMLDivElement>(null);
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  const [outlineOpen, setOutlineOpen] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  // 点目录跳转时把高亮"锁"在目标标题上：平滑滚动期间容器每一帧都触发 onScroll，
  // 滚动监听会不停重算"当前标题"，高亮就会在中间的标题之间来回闪/跳，
  // 落地后还可能被上一次滚动算出的值盖掉。锁到滚动停稳（末次 scroll 后 240ms）为止。
  const lockIdRef = useRef<string | null>(null);
  const unlockTimerRef = useRef<number | null>(null);
  const onTitleChangeRef = useRef(onTitleChange);
  onTitleChangeRef.current = onTitleChange;

  const syncTitle = useCallback(() => {
    onTitleChangeRef.current?.(extractTitle(editor.document));
  }, [editor]);

  // 文档切换时加载内容：优先权威 blockData，降级解析 markdown
  useEffect(() => {
    let cancelled = false;
    const apply = async () => {
      const blocks = parseBlockJson(blockData);
      if (blocks) {
        editor.replaceBlocks(editor.document, blocks);
        setOutline(extractOutline(editor.document));
        syncTitle();
        setActiveId(null);
        return;
      }
      try {
        const mdBlocks = await editor.tryParseMarkdownToBlocks(markdownText || '');
        if (cancelled) return;
        editor.replaceBlocks(editor.document, mdBlocks);
        setOutline(extractOutline(editor.document));
        syncTitle();
        setActiveId(null);
      } catch {
        // 解析失败保持空文档，不阻塞编辑
      }
    };
    void apply();
    return () => {
      cancelled = true;
    };
  }, [editor, docId, blockData, markdownText, syncTitle]);

  // 内容变化时同步侧目录
  useEffect(() => {
    const unsub = editor.onChange(() => {
      setOutline(extractOutline(editor.document));
      syncTitle();
    });
    return () => {
      unsub?.();
    };
  }, [editor, syncTitle]);

  const scrollToHeading = useCallback(
    (id: string) => {
      const el = editor.domElement?.querySelector<HTMLElement>(`[data-id="${id}"]`);
      if (el) {
        lockIdRef.current = id;
        if (unlockTimerRef.current) window.clearTimeout(unlockTimerRef.current);
        setActiveId(id);
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
    [editor],
  );

  /** 用户自己滚动/触摸/按键时立刻交还控制权，别让锁把高亮钉住 */
  const releaseLock = useCallback(() => {
    lockIdRef.current = null;
    if (unlockTimerRef.current) {
      window.clearTimeout(unlockTimerRef.current);
      unlockTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => {
    if (unlockTimerRef.current) window.clearTimeout(unlockTimerRef.current);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      snapshot: async () => ({
        blockData: JSON.stringify(editor.document),
        markdownText: await editor.blocksToMarkdownLossy(),
      }),
      focusTitle: () => {
        const headings = extractOutline(editor.document);
        const target = headings.find((h) => h.level === 1) ?? headings[0];
        if (target) scrollToHeading(target.id);
      },
    }),
    [editor, scrollToHeading],
  );

  // 滚动时高亮当前所在标题
  const handleScroll = useCallback(() => {
    // 点目录跳转的滚动过程中不动高亮，等它停稳再说
    if (lockIdRef.current) {
      if (unlockTimerRef.current) window.clearTimeout(unlockTimerRef.current);
      unlockTimerRef.current = window.setTimeout(() => {
        lockIdRef.current = null;
        unlockTimerRef.current = null;
      }, 240);
      return;
    }
    const container = scrollRef.current;
    const root = editor.domElement;
    if (!container || !root || outline.length === 0) return;
    const top = container.getBoundingClientRect().top;
    let current: string | null = outline[0].id;
    for (const item of outline) {
      const el = root.querySelector<HTMLElement>(`[data-id="${item.id}"]`);
      if (!el) continue;
      if (el.getBoundingClientRect().top - top > 96) break;
      current = item.id;
    }
    setActiveId(current);
  }, [editor, outline]);

  return (
    <div className="doc-editor-root">
      {outlineOpen && (
        <aside className="doc-outline">
          <div className="doc-outline-title">目录</div>
          {outline.length === 0 ? (
            <div className="doc-outline-empty">暂无标题，输入「# 标题」即可生成目录。</div>
          ) : (
            <div className="doc-outline-list">
              {outline.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={'doc-outline-item' + (activeId === item.id ? ' is-active' : '')}
                  style={{
                    paddingLeft: 10 + (item.level - 1) * 14,
                    fontWeight: item.level === 1 ? 600 : 400,
                  }}
                  onClick={() => scrollToHeading(item.id)}
                >
                  {item.text}
                </button>
              ))}
            </div>
          )}
        </aside>
      )}

      <div className="doc-editor-main">
        <div className="doc-editor-toolbar">
          <Tooltip title={outlineOpen ? '收起目录' : '展开目录'}>
            <button
              type="button"
              className={'doc-editor-toolbar-btn' + (outlineOpen ? ' is-on' : '')}
              onClick={() => setOutlineOpen((v) => !v)}
            >
              <Icon icon={listTreeIcon} width={16} />
            </button>
          </Tooltip>
          <span className="doc-editor-hint">输入「/」插入块，拖动块左侧手柄调整顺序</span>
        </div>

        <div
          ref={scrollRef}
          className="doc-editor-scroll"
          onScroll={handleScroll}
          onWheel={releaseLock}
          onTouchStart={releaseLock}
        >
          <BlockNoteView
            editor={editor}
            theme={isDark ? 'dark' : 'light'}
          />
        </div>
      </div>
    </div>
  );
});

export default DocEditor;
