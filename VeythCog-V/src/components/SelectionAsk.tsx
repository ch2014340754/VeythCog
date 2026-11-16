/**
 * 全局划词 AI
 * ------------------------------------------------------------
 * 交互：选中文字 → 悬浮条（解释 / 翻译 / 润色 / 问 / 存入知识库）→ 结果卡流式出字。
 *
 * 几条刻意的取舍：
 * - 只在 `pointer: fine`（有鼠标）的设备挂载；触屏上长按选词和悬浮条会互相抢手势。
 * - 不写对话历史：划词是"看一眼就关"的动作，落库只会把会话列表撑满。
 * - 结果 24h 双层缓存（本组件先查 localStorage，后端再查自己的 TTL Map），
 *   命中时 0ms 出字并标注"缓存"；「重新生成」带 nocache=true 跳过后端缓存。
 * - 结果卡自己维护 DOM，不走 Modal/Portal：要让卡片贴着选区出现，跟随滚动。
 */
import React from 'react';
import ReactMarkdown from 'react-markdown';
import { message } from 'antd';
import { createDoc } from '@/api/knowledge';
import { streamQuickAi, type QuickAiAction, type QuickAiMeta } from '@/api/quickAi';
import { getCachedQuickAi, setCachedQuickAi } from '@/utils/quickAiCache';
import { useSelectionAskStore } from '@/stores/selectionAskStore';
import type { RetrieveChunk } from '@/types';
import '@/styles/selectionAsk.css';

interface Anchor {
  text: string;
  top: number;
  left: number;
  bottom: number;
  width: number;
}

type Phase = 'asking' | 'streaming' | 'done' | 'error' | 'input';

interface PanelState {
  action: QuickAiAction;
  anchor: Anchor;
  phase: Phase;
  content: string;
  meta: QuickAiMeta | null;
  references: RetrieveChunk[];
  error: string;
  withKnowledge: boolean;
  fromCache: boolean;
  question?: string;
}

const ACTIONS: { key: QuickAiAction; label: string; hint: string }[] = [
  { key: 'explain', label: '解释', hint: '这段是什么意思（通用解释，不必在知识库里）' },
  { key: 'translate', label: '翻译', hint: '中→英 / 其它语言→中' },
  { key: 'polish', label: '润色', hint: '保持原意，改得更简洁通顺' },
  { key: 'ask', label: '问', hint: '针对这段内容提问' },
];

const MAX_SELECT_CHARS = 3000;

/** 块编辑器（BlockNote / ProseMirror）根节点：这里选中文字已有自己的格式菜单，划词改由右键唤出 */
const EDITOR_SELECTOR = '.bn-container, .bn-editor, .ProseMirror';

function isEditorTarget(node: Node | null): boolean {
  const el: HTMLElement | null =
    node instanceof HTMLElement ? node : node?.parentElement ?? null;
  return !!el?.closest?.(EDITOR_SELECTOR);
}

/** 选区是否落在不该触发划词的地方（自身 UI / 输入框 / 编辑器） */
function isIgnoredTarget(node: Node | null): boolean {
  let el: HTMLElement | null = node instanceof HTMLElement ? node : node?.parentElement ?? null;
  while (el) {
    if (el.closest?.('.vc-selbar, .vc-askcard, .vc-ask-input')) return true;
    const tag = el.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
    if (el.isContentEditable) return true;
    el = el.parentElement;
  }
  return false;
}

const SelectionAsk: React.FC = () => {
  const enabled = useSelectionAskStore((s) => s.enabled);
  const [finePointer, setFinePointer] = React.useState<boolean>(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(pointer: fine)').matches
      : false,
  );
  const [bar, setBar] = React.useState<Anchor | null>(null);
  const [panel, setPanel] = React.useState<PanelState | null>(null);
  const [questionDraft, setQuestionDraft] = React.useState('');
  const controllerRef = React.useRef<AbortController | null>(null);
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const barRef = React.useRef<HTMLDivElement | null>(null);

  // 屏幕形态会随外接显示器/平板键盘切换，监听一下而不是只在启动时判断一次
  React.useEffect(() => {
    const mq = window.matchMedia('(pointer: fine)');
    const handler = (e: MediaQueryListEvent) => setFinePointer(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const active = enabled && finePointer;

  const stopStream = React.useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
  }, []);

  const closeAll = React.useCallback(() => {
    stopStream();
    setBar(null);
    setPanel(null);
    setQuestionDraft('');
  }, [stopStream]);

  // Esc 关闭
  React.useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeAll();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, closeAll]);

  // 点空白处关闭（点卡片内部不关）
  React.useEffect(() => {
    if (!bar && !panel) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || barRef.current?.contains(target)) return;
      closeAll();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [bar, panel, closeAll]);

  // 选中 → 悬浮条（块编辑器内不接管，交给右键，见下面的 contextmenu）
  React.useEffect(() => {
    if (!active) return;
    const onMouseUp = (e: MouseEvent) => {
      window.setTimeout(() => {
        // 卡片/悬浮条内的点击不重新取词
        if (isIgnoredTarget(e.target as Node)) return;
        if (isEditorTarget(e.target as Node)) return;
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
          return;
        }
        if (isIgnoredTarget(sel.anchorNode)) return;
        const raw = sel.toString().replace(/\s+/g, ' ').trim();
        if (raw.length < 2) {
          setBar(null);
          return;
        }
        if (raw.length > MAX_SELECT_CHARS) {
          message.info('选中内容过长，只取前 3000 字');
        }
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return;
        setBar({
          text: raw.slice(0, MAX_SELECT_CHARS),
          top: rect.top,
          bottom: rect.bottom,
          left: rect.left,
          width: rect.width,
        });
        setPanel(null);
      }, 0);
    };
    document.addEventListener('mouseup', onMouseUp);
    return () => document.removeEventListener('mouseup', onMouseUp);
  }, [active]);

  // 块编辑器内：右键唤出划词条
  // BlockNote 选中文字后自己会弹格式菜单（加粗/链接…），再叠一条悬浮条会互相抢位置，
  // 所以编辑器里改成"先选中、再右键"——右键本身在纯阅读态也没有别的用途。
  React.useEffect(() => {
    if (!active) return;
    const onContextMenu = (e: MouseEvent) => {
      if (!isEditorTarget(e.target as Node)) return;
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      const node = range.commonAncestorContainer;
      const host: HTMLElement | null =
        node instanceof HTMLElement ? node : node.parentElement;
      // 选区必须真的落在同一个编辑器里，避免拖到卡片文字上时误接管
      if (!host?.closest?.(EDITOR_SELECTOR)) return;
      const raw = sel.toString().replace(/\s+/g, ' ').trim();
      if (raw.length < 2) return;
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;

      e.preventDefault();
      e.stopPropagation();
      if (raw.length > MAX_SELECT_CHARS) {
        message.info('选中内容过长，只取前 3000 字');
      }
      setBar({
        text: raw.slice(0, MAX_SELECT_CHARS),
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        width: rect.width,
      });
      setPanel(null);
    };
    document.addEventListener('contextmenu', onContextMenu);
    return () => document.removeEventListener('contextmenu', onContextMenu);
  }, [active]);

  // 滚动时收起悬浮条（卡片跟着选区会被甩出可视区，收掉更干净）
  React.useEffect(() => {
    if (!bar) return;
    const onScroll = () => setBar(null);
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    return () => window.removeEventListener('scroll', onScroll, { capture: true } as EventListenerOptions);
  }, [bar]);

  /** 发起一次请求（先查本地缓存） */
  const run = React.useCallback(
    (action: QuickAiAction, anchor: Anchor, text: string, withKnowledge: boolean, question?: string, force = false) => {
      stopStream();

      const cached = force || action === 'ask' || withKnowledge ? null : getCachedQuickAi(action, text);
      if (cached) {
        setPanel({
          action,
          anchor,
          phase: 'done',
          content: cached.text,
          meta: { cached: true, cachedAt: cached.at },
          references: [],
          error: '',
          withKnowledge,
          fromCache: true,
          question,
        });
        return;
      }

      setPanel({
        action,
        anchor,
        phase: 'streaming',
        content: '',
        meta: null,
        references: [],
        error: '',
        withKnowledge,
        fromCache: false,
        question,
      });

      let acc = '';
      controllerRef.current = streamQuickAi({
        action,
        text,
        pageTitle: document.title,
        withKnowledge,
        question,
        nocache: force,
        onMeta: (meta) => {
          setPanel((prev) => (prev ? { ...prev, meta } : prev));
        },
        onReferences: (refs) => {
          setPanel((prev) => (prev ? { ...prev, references: refs } : prev));
        },
        onDelta: (delta) => {
          acc += delta;
          setPanel((prev) => (prev ? { ...prev, content: acc } : prev));
        },
        onDone: () => {
          setPanel((prev) => (prev ? { ...prev, phase: 'done' } : prev));
          setCachedQuickAi(action, text, acc);
        },
        onError: (err) => {
          setPanel((prev) => (prev ? { ...prev, phase: 'error', error: err.message } : prev));
        },
      });
    },
    [stopStream],
  );

  const handleAction = (action: QuickAiAction) => {
    if (!bar) return;
    const anchor = bar;
    if (action === 'ask') {
      setPanel({
        action,
        anchor,
        phase: 'input',
        content: '',
        meta: null,
        references: [],
        error: '',
        withKnowledge: false,
        fromCache: false,
      });
      setQuestionDraft('');
      setBar(null);
      return;
    }
    setBar(null);
    run(action, anchor, anchor.text, false);
  };

  /** 存入知识库：选中文字直接建成一篇 Markdown 文档 */
  const saveToKnowledge = async () => {
    if (!bar) return;
    const text = bar.text;
    setBar(null);
    const title = `划词 · ${document.title || new Date().toLocaleString('zh-CN')}`.slice(0, 120);
    const quote = text.split('\n').map((line) => `> ${line}`).join('\n');
    const markdown = `${quote}\n\n---\n来源：${window.location.href}\n`;
    try {
      await createDoc({
        title,
        summary: text.slice(0, 200),
        markdownText: markdown,
        blockData: '[]',
        tags: ['划词笔记'],
      });
      message.success('已存入知识库（可在知识库页向量化后参与 AI 检索）');
    } catch (e) {
      message.error((e as Error).message || '存入失败');
    }
  };

  if (!active) return null;

  const barStyle: React.CSSProperties | undefined = bar
    ? {
        left: Math.min(Math.max(bar.left + bar.width / 2, 140), window.innerWidth - 140),
        top: Math.max(bar.top - 8, 8),
        transform: 'translate(-50%, -100%)',
      }
    : undefined;

  const panelWidth = Math.min(460, Math.max(320, window.innerWidth - 32));
  const panelStyle: React.CSSProperties | undefined = panel
    ? {
        left: Math.min(Math.max(panel.anchor.left, 12), window.innerWidth - panelWidth - 12),
        top: Math.min(panel.anchor.bottom + 10, window.innerHeight - 120),
        width: panelWidth,
      }
    : undefined;

  const toggleKnowledge = () => {
    if (!panel || panel.action === 'ask') return;
    run(panel.action, panel.anchor, panel.anchor.text, !panel.withKnowledge);
  };

  const regenerate = () => {
    if (!panel) return;
    run(panel.action, panel.anchor, panel.anchor.text, panel.withKnowledge, panel.question, true);
  };

  return (
    <>
      {bar && (
        <div className="vc-selbar" ref={barRef} style={barStyle} role="toolbar" aria-label="划词操作">
          {ACTIONS.map((item) => (
            <button
              key={item.key}
              type="button"
              className="vc-selbar__btn"
              title={item.hint}
              onClick={() => handleAction(item.key)}
            >
              {item.label}
            </button>
          ))}
          <span className="vc-selbar__divider" aria-hidden />
          <button type="button" className="vc-selbar__btn" title="选中文字存成知识库文档" onClick={saveToKnowledge}>
            存入知识库
          </button>
        </div>
      )}

      {panel && (
        <div className="vc-askcard" ref={panelRef} style={panelStyle} role="dialog" aria-label="划词结果">
          <header className="vc-askcard__head">
            <span className="vc-askcard__title">
              {ACTIONS.find((a) => a.key === panel.action)?.label ?? '解释'}
              {panel.meta?.modelName ? <span className="vc-askcard__model">{panel.meta.modelName}</span> : null}
              {panel.fromCache || panel.meta?.cached ? <span className="vc-askcard__badge">缓存 · 24h</span> : null}
              {panel.withKnowledge && panel.meta?.knowledgeHit ? (
                <span className="vc-askcard__badge is-kb">知识库 {panel.references.length}</span>
              ) : null}
            </span>
            <span className="vc-askcard__tools">
              {panel.phase !== 'input' && (
                <>
                  <button
                    type="button"
                    className={`vc-askcard__tool${panel.withKnowledge ? ' is-on' : ''}`}
                    onClick={toggleKnowledge}
                    title="结合知识库检索（默认关：多数划词要的是通用解释）"
                  >
                    知识库
                  </button>
                  <button type="button" className="vc-askcard__tool" onClick={regenerate} title="重新生成（跳过缓存）">
                    重新生成
                  </button>
                  <button
                    type="button"
                    className="vc-askcard__tool"
                    onClick={() => {
                      navigator.clipboard?.writeText(panel.content).then(
                        () => message.success('已复制'),
                        () => message.error('复制失败'),
                      );
                    }}
                    title="复制结果"
                  >
                    复制
                  </button>
                </>
              )}
              <button type="button" className="vc-askcard__tool" onClick={closeAll} title="关闭">
                关闭
              </button>
            </span>
          </header>

          {panel.phase === 'input' ? (
            <div className="vc-askcard__input-wrap">
              <textarea
                className="vc-ask-input"
                autoFocus
                rows={2}
                value={questionDraft}
                placeholder="想问这段内容的什么？例如：这个报错怎么修"
                onChange={(e) => setQuestionDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && questionDraft.trim()) {
                    e.preventDefault();
                    run('ask', panel.anchor, panel.anchor.text, false, questionDraft.trim());
                  }
                }}
              />
              <button
                type="button"
                className="vc-askcard__send"
                disabled={!questionDraft.trim()}
                onClick={() => run('ask', panel.anchor, panel.anchor.text, false, questionDraft.trim())}
              >
                发送
              </button>
            </div>
          ) : (
            <div className="vc-askcard__body">
              {panel.phase === 'streaming' && !panel.content && <div className="vc-askcard__hint">正在生成…</div>}
              {panel.error && <div className="vc-askcard__error">{panel.error}</div>}
              {panel.content && (
                <div className="vc-askcard__md">
                  <ReactMarkdown>{panel.content}</ReactMarkdown>
                  {panel.phase === 'streaming' && <span className="vc-askcard__caret" aria-hidden />}
                </div>
              )}
              {panel.references.length > 0 && (
                <div className="vc-askcard__refs">
                  <span className="vc-askcard__refs-label">引用</span>
                  {panel.references.slice(0, 4).map((ref, i) => (
                    <span key={`${ref.docId}-${ref.chunkIndex}-${i}`} className="vc-askcard__ref" title={ref.chunkText}>
                      {ref.title || `文档 ${ref.docId}`}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default SelectionAsk;
