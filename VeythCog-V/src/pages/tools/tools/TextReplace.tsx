import React, { useState, useRef, useEffect } from 'react';
import { Input, Button, Switch, message } from 'antd';
import { Icon } from '@iconify/react';
import copyIcon from '@iconify-icons/lucide/copy';
import checkIcon from '@iconify-icons/lucide/check';
import historyIcon from '@iconify-icons/lucide/history';
import trashIcon from '@iconify-icons/lucide/trash-2';
import closeIcon from '@iconify-icons/lucide/x';
import ToolShell from '../ToolShell';

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

function highlightOccurrences(text: string, match: string, useRegex: boolean, variant: 'add' | 'del'): React.ReactNode {
  if (!match) return text;
  const className = variant === 'del' ? 'vc-mark vc-mark--del' : 'vc-mark';
  try {
    if (useRegex) {
      const parts = text.split(new RegExp(`(${match})`, 'g'));
      return parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className={className}>{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      );
    }
    const parts = text.split(match);
    const out: React.ReactNode[] = [];
    parts.forEach((p, i) => {
      if (i > 0) out.push(<mark key={`m${i}`} className={className}>{match}</mark>);
      out.push(<span key={`p${i}`}>{p}</span>);
    });
    return out;
  } catch {
    return text;
  }
}

const TextReplace: React.FC = () => {
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

  const copyResult = async () => {
    const text = result.map((s) => s.text).join('');
    await navigator.clipboard.writeText(text);
    setCopied(true);
    message.success('已复制');
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <ToolShell
      title="文本替换"
      description="支持正则，替换后高亮显示被替换的位置"
      actions={
        <div className="vc-toolbar" style={{ padding: 0, border: 'none', background: 'transparent', gap: 'var(--space-md)' }}>
          <span className="vc-meta">正则</span>
          <Switch checked={useRegex} onChange={setUseRegex} size="small" />
          <span className="vc-meta">自动复制</span>
          <Switch checked={autoCopy} onChange={setAutoCopy} size="small" />
          <Button type="primary" onClick={run} disabled={!find || !source}>
            替换
          </Button>
        </div>
      }
    >
      <div className="vc-stack">
        <div className="vc-panel">
          <div className="vc-panel__head">
            <div>
              <h2 className="vc-panel__title">原文</h2>
            </div>
            <span className="vc-meta">{source.length.toLocaleString()} 字符</span>
          </div>
          <Input.TextArea
            className="vc-mono-input"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="粘贴原文"
            autoSize={{ minRows: 5, maxRows: 10 }}
          />
        </div>

        <div className="vc-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div>
            <div className="vc-field-label">查找内容{useRegex ? '（正则）' : ''}</div>
            <Input
              className="vc-mono-input"
              value={find}
              onChange={(e) => setFind(e.target.value)}
              placeholder={useRegex ? '\\bfoo\\b' : 'foo'}
            />
          </div>
          <div>
            <div className="vc-field-label">替换为</div>
            <Input
              className="vc-mono-input"
              value={replacement}
              onChange={(e) => setReplacement(e.target.value)}
              placeholder="bar"
            />
          </div>
        </div>

        {error && <div className="vc-tool-error">{error}</div>}

        {result.length > 0 && (
          <div className="vc-panel">
            <div className="vc-panel__head">
              <div>
                <h2 className="vc-panel__title">结果</h2>
                <p className="vc-panel__desc">
                  共替换 <span className="vc-num" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>{count}</span> 处，高亮为替换后的内容。
                </p>
              </div>
              <button className="vc-icon-btn" onClick={copyResult}>
                <Icon icon={copied ? checkIcon : copyIcon} width={13} />
                {copied ? '已复制' : '复制'}
              </button>
            </div>
            <pre className="vc-json-pre" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.8 }}>
              {result.map((seg, i) =>
                seg.isReplaced ? (
                  <mark key={i} className="vc-mark">{seg.text}</mark>
                ) : (
                  <span key={i}>{seg.text}</span>
                )
              )}
            </pre>
          </div>
        )}

        {history.length > 0 && (
          <div className="vc-panel">
            <div className="vc-panel__head">
              <div>
                <h2 className="vc-panel__title">
                  <Icon icon={historyIcon} width={16} style={{ marginRight: 6, verticalAlign: '-2px' }} />
                  替换历史
                </h2>
                <p className="vc-panel__desc">近 {history.length} 条，点任意一条查看对比。</p>
              </div>
              <button className="vc-icon-btn" onClick={() => setHistory([])}>
                <Icon icon={trashIcon} width={13} />
                清空
              </button>
            </div>
            <div className="vc-stack vc-stack--tight">
              {history.map((item) => (
                <button key={item.id} className="vc-history-row" onClick={() => openDlg(item)}>
                  <span className="vc-history-row__time">{item.time}</span>
                  <span className="vc-history-row__main">
                    <span style={{ color: 'var(--color-text-tertiary)' }}>{item.useRegex ? '正则' : '文本'}</span>{' '}
                    <span style={{ color: 'var(--color-error)' }}>{item.find.length > 30 ? item.find.slice(0, 30) + '…' : item.find}</span>
                    {' → '}
                    <span style={{ color: 'var(--color-primary)' }}>
                      {item.replacement.length > 30 ? item.replacement.slice(0, 30) + '…' : item.replacement}
                    </span>
                  </span>
                  <span className="vc-history-row__count">{item.count} 处</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {selected && (
        <>
          <div className="vc-dialog-scrim" onClick={() => setSelected(null)} />
          <div
            className="vc-floating-dialog"
            style={{ left: dlgPos.x, top: dlgPos.y, width: dlgSize.w, height: dlgSize.h }}
          >
            <div className="vc-floating-dialog__head" onMouseDown={(e) => startDrag(e, 'move')}>
              <div className="vc-floating-dialog__title">
                <span style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }}>{selected.time}</span>
                <span style={{ fontFamily: "'JetBrains Mono', Consolas, monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <span style={{ color: 'var(--color-error)' }}>{selected.find}</span>
                  {' → '}
                  <span style={{ color: 'var(--color-primary)' }}>{selected.replacement}</span>
                </span>
                <span className="vc-meta" style={{ flexShrink: 0 }}>{selected.count} 处</span>
              </div>
              <button className="vc-icon-btn" onClick={() => setSelected(null)}>
                <Icon icon={closeIcon} width={16} />
              </button>
            </div>

            <div className="vc-floating-dialog__body">
              <div className="vc-floating-dialog__pane">
                <div className="vc-floating-dialog__label" style={{ color: 'var(--color-error)' }}>原文（高亮为被替换）</div>
                <div className="vc-diff-box">
                  {highlightOccurrences(selected.source, selected.find, selected.useRegex, 'del')}
                </div>
              </div>
              <div className="vc-floating-dialog__pane">
                <div className="vc-floating-dialog__label" style={{ color: 'var(--color-primary)' }}>替换后（高亮为新内容）</div>
                <div className="vc-diff-box">
                  {highlightOccurrences(selected.resultText, selected.replacement, false, 'add')}
                </div>
              </div>
            </div>

            <div className="vc-floating-dialog__resize" onMouseDown={(e) => startDrag(e, 'resize')} />
          </div>
        </>
      )}
    </ToolShell>
  );
};

export default TextReplace;
