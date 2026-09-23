import React, { useState, useRef, useEffect } from 'react';
import { Input, Button, Switch, message } from 'antd';
import { Icon } from '@iconify/react';
import copyIcon from '@iconify-icons/lucide/copy';
import checkIcon from '@iconify-icons/lucide/check';
import historyIcon from '@iconify-icons/lucide/history';
import trashIcon from '@iconify-icons/lucide/trash-2';
import closeIcon from '@iconify-icons/lucide/x';
import ToolShell from '../ToolShell';
import { useTheme } from '@/contexts/ThemeContext';

interface MatchSeg {
  text: string;
  isReplaced: boolean;
}

interface HistoryItem {
  id: number;
  time: string;
  find: string;
  replacement: string;
  source: string;
  resultText: string;
  count: number;
  useRegex: boolean;
}

const MAX_HISTORY = 50;

function highlightOccurrences(
  text: string,
  match: string,
  useRegex: boolean,
  bg: string,
  color: string
): React.ReactNode {
  if (!match) return text;
  const style: React.CSSProperties = { background: bg, color, padding: '0 2px', borderRadius: 2 };
  try {
    if (useRegex) {
      const parts = text.split(new RegExp(`(${match})`, 'g'));
      return parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} style={style}>{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      );
    }
    const parts = text.split(match);
    const out: React.ReactNode[] = [];
    parts.forEach((p, i) => {
      if (i > 0) out.push(<mark key={`m${i}`} style={style}>{match}</mark>);
      out.push(<span key={`p${i}`}>{p}</span>);
    });
    return out;
  } catch {
    return text;
  }
}

const TextReplace: React.FC = () => {
  const { colors } = useTheme();
  const [source, setSource] = useState('');
  const [find, setFind] = useState('');
  const [replacement, setReplacement] = useState('');
  const [useRegex, setUseRegex] = useState(false);
  const [autoCopy, setAutoCopy] = useState(false);
  const [result, setResult] = useState<MatchSeg[]>([]);
  const [count, setCount] = useState(0);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [selected, setSelected] = useState<HistoryItem | null>(null);

  const [dlgPos, setDlgPos] = useState({ x: 0, y: 0 });
  const [dlgSize, setDlgSize] = useState({ w: 960, h: 600 });
  const dragState = useRef<{
    mode: 'move' | 'resize';
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
  } | null>(null);

  const startDrag = (e: React.MouseEvent, mode: 'move' | 'resize') => {
    e.preventDefault();
    dragState.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      origX: dlgPos.x,
      origY: dlgPos.y,
      origW: dlgSize.w,
      origH: dlgSize.h,
    };
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const s = dragState.current;
      if (!s) return;
      const dx = e.clientX - s.startX;
      const dy = e.clientY - s.startY;
      if (s.mode === 'move') {
        setDlgPos({ x: s.origX + dx, y: s.origY + dy });
      } else {
        setDlgSize({ w: Math.max(600, s.origW + dx), h: Math.max(400, s.origH + dy) });
      }
    };
    const onUp = () => { dragState.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const openDlg = (item: HistoryItem) => {
    setSelected(item);
    setDlgPos({
      x: window.innerWidth / 2 - dlgSize.w / 2,
      y: window.innerHeight / 2 - dlgSize.h / 2,
    });
  };

  const run = () => {
    setError('');
    setResult([]);
    setCount(0);
    if (!find) return;

    try {
      let segments: MatchSeg[] = [];
      let matchCount = 0;

      if (useRegex) {
        const re = new RegExp(find, 'g');
        let last = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(source)) !== null) {
          if (m.index > last) segments.push({ text: source.slice(last, m.index), isReplaced: false });
          segments.push({ text: replacement, isReplaced: true });
          last = m.index + m[0].length;
          matchCount++;
          if (m[0].length === 0) re.lastIndex++;
        }
        if (last < source.length) segments.push({ text: source.slice(last), isReplaced: false });
      } else {
        const parts = source.split(find);
        matchCount = parts.length - 1;
        segments = parts.flatMap((part, i) =>
          i === parts.length - 1
            ? [{ text: part, isReplaced: false }]
            : [{ text: part, isReplaced: false }, { text: replacement, isReplaced: true }]
        );
      }

      setResult(segments);
      setCount(matchCount);

      const resultText = segments.map((s) => s.text).join('');

      if (autoCopy && matchCount > 0) {
        navigator.clipboard.writeText(resultText).catch(() => {});
      }

      if (matchCount > 0) {
        const now = new Date();
        const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        setHistory((prev) =>
          [
            {
              id: Date.now(),
              time,
              find,
              replacement,
              source,
              resultText,
              count: matchCount,
              useRegex,
            },
            ...prev,
          ].slice(0, MAX_HISTORY)
        );
      }
    } catch (e: any) {
      setError('正则错误：' + e.message);
    }
  };

  return (
    <ToolShell
      title="文本替换"
      description="支持正则，替换后高亮显示被替换的位置"
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, color: colors.textSecondary }}>正则</span>
          <Switch checked={useRegex} onChange={setUseRegex} size="small" />
          <span style={{ fontSize: 13, color: colors.textSecondary }}>自动复制</span>
          <Switch checked={autoCopy} onChange={setAutoCopy} size="small" />
          <Button size="small" type="primary" onClick={run} disabled={!find || !source}>
            替换
          </Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>原文</div>
          <Input.TextArea
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="粘贴原文"
            autoSize={{ minRows: 5, maxRows: 10 }}
            style={{ fontFamily: "'JetBrains Mono', Consolas, monospace", fontSize: 13 }}
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>查找内容{useRegex ? '（正则）' : ''}</div>
            <Input
              value={find}
              onChange={(e) => setFind(e.target.value)}
              placeholder={useRegex ? '\\bfoo\\b' : 'foo'}
              style={{ fontFamily: "'JetBrains Mono', Consolas, monospace" }}
            />
          </div>
          <div>
            <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>替换为</div>
            <Input
              value={replacement}
              onChange={(e) => setReplacement(e.target.value)}
              placeholder="bar"
              style={{ fontFamily: "'JetBrains Mono', Consolas, monospace" }}
            />
          </div>
        </div>

        {error && <div style={{ color: colors.error, fontSize: 12 }}>{error}</div>}

        {count > 0 && (
          <div style={{ fontSize: 12, color: colors.textSecondary }}>
            共替换 <span style={{ color: colors.primary, fontWeight: 600 }}>{count}</span> 处
          </div>
        )}

        {result.length > 0 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontSize: 12, color: colors.textSecondary }}>结果（高亮为替换处）</div>
              <button
                onClick={async () => {
                  const text = result.map((s) => s.text).join('');
                  await navigator.clipboard.writeText(text);
                  setCopied(true);
                  message.success('已复制');
                  setTimeout(() => setCopied(false), 1500);
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: colors.primary,
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Icon icon={copied ? checkIcon : copyIcon} width={12} />
                {copied ? '已复制' : '复制'}
              </button>
            </div>
            <div
              style={{
                padding: 12,
                background: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: 'var(--radius-md)',
                fontFamily: "'JetBrains Mono', Consolas, monospace",
                fontSize: 13,
                lineHeight: 1.8,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {result.map((seg, i) =>
                seg.isReplaced ? (
                  <mark
                    key={i}
                    style={{
                      background: colors.primary15,
                      color: colors.primary,
                      borderRadius: 2,
                      padding: '0 3px',
                    }}
                  >
                    {seg.text}
                  </mark>
                ) : (
                  <span key={i}>{seg.text}</span>
                )
              )}
            </div>
          </div>
        )}

        {history.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: colors.textSecondary }}>
                <Icon icon={historyIcon} width={14} />
                替换历史（近 {history.length} 条，点一条查看 diff）
              </div>
              <button
                onClick={() => setHistory([])}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: colors.textTertiary,
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Icon icon={trashIcon} width={12} />
                清空
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {history.map((item) => (
                <div
                  key={item.id}
                  onClick={() => openDlg(item)}
                  style={{
                    padding: '8px 12px',
                    background: colors.surface,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    fontSize: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = colors.primary10)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = colors.surface)}
                >
                  <span style={{ color: colors.textTertiary, fontFamily: "'JetBrains Mono', monospace", flexShrink: 0 }}>
                    {item.time}
                  </span>
                  <span
                    style={{
                      flex: 1,
                      fontFamily: "'JetBrains Mono', monospace",
                      color: colors.text,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <span style={{ color: colors.textTertiary }}>{item.useRegex ? '正则' : '文本'}</span>{' '}
                    <span style={{ color: colors.error }}>{item.find.length > 30 ? item.find.slice(0, 30) + '…' : item.find}</span>
                    {' → '}
                    <span style={{ color: colors.primary }}>
                      {item.replacement.length > 30 ? item.replacement.slice(0, 30) + '…' : item.replacement}
                    </span>
                  </span>
                  <span style={{ color: colors.textTertiary, flexShrink: 0 }}>{item.count} 处</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {selected && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000 }}
            onClick={() => setSelected(null)}
          />
          <div
            style={{
              position: 'fixed',
              left: dlgPos.x,
              top: dlgPos.y,
              width: dlgSize.w,
              height: dlgSize.h,
              background: colors.surface,
              borderRadius: 12,
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
              zIndex: 1001,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div
              onMouseDown={(e) => startDrag(e, 'move')}
              style={{
                padding: '10px 16px',
                borderBottom: `1px solid ${colors.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'move',
                userSelect: 'none',
                background: colors.surface,
              }}
            >
              <div style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <span style={{ color: colors.textSecondary, flexShrink: 0 }}>{selected.time}</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <span style={{ color: colors.error }}>{selected.find}</span>
                  {' → '}
                  <span style={{ color: colors.primary }}>{selected.replacement}</span>
                </span>
                <span style={{ color: colors.textTertiary, fontSize: 12, flexShrink: 0 }}>{selected.count} 处</span>
              </div>
              <button
                onClick={() => setSelected(null)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: colors.textSecondary, padding: 4, display: 'flex', flexShrink: 0 }}
              >
                <Icon icon={closeIcon} width={16} />
              </button>
            </div>

            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: 16, overflow: 'hidden' }}>
              <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <div style={{ fontSize: 12, color: colors.error, marginBottom: 6 }}>原文（红底为被替换）</div>
                <div
                  style={{
                    flex: 1,
                    padding: 12,
                    background: colors.bg,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 8,
                    fontFamily: "'JetBrains Mono', Consolas, monospace",
                    fontSize: 12,
                    lineHeight: 1.8,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    overflow: 'auto',
                  }}
                >
                  {highlightOccurrences(selected.source, selected.find, selected.useRegex, colors.error + '22', colors.error)}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <div style={{ fontSize: 12, color: colors.primary, marginBottom: 6 }}>替换后（蓝底为新内容）</div>
                <div
                  style={{
                    flex: 1,
                    padding: 12,
                    background: colors.bg,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 8,
                    fontFamily: "'JetBrains Mono', Consolas, monospace",
                    fontSize: 12,
                    lineHeight: 1.8,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    overflow: 'auto',
                  }}
                >
                  {highlightOccurrences(selected.resultText, selected.replacement, false, colors.primary15, colors.primary)}
                </div>
              </div>
            </div>

            <div
              onMouseDown={(e) => startDrag(e, 'resize')}
              style={{
                position: 'absolute',
                right: 0,
                bottom: 0,
                width: 16,
                height: 16,
                cursor: 'nwse-resize',
                background: `linear-gradient(135deg, transparent 50%, ${colors.border} 50%)`,
                borderTopLeftRadius: 8,
              }}
            />
          </div>
        </>
      )}
    </ToolShell>
  );
};

export default TextReplace;
