import React, { useMemo, useRef, useState } from 'react';
import { Input, Button, Radio, Tooltip, Popover, Segmented, message } from 'antd';
import { Icon } from '@iconify/react';
import volumeIcon from '@iconify-icons/lucide/volume-2';
import copyIcon from '@iconify-icons/lucide/copy';
import swapIcon from '@iconify-icons/lucide/arrow-left-right';
import historyIcon from '@iconify-icons/lucide/history';
import trashIcon from '@iconify-icons/lucide/trash-2';
import { pinyin } from 'pinyin-pro';
import ToolShell from '../ToolShell';
import { useTheme } from '@/contexts/ThemeContext';
import { storage } from '@/utils/storage';
import engDict from './data/engDict.json';

type Direction = 'auto' | 'zh2en' | 'en2zh';
type CaseMode = 'original' | 'lower' | 'upper' | 'camel';

/** 是否包含中文字符 */
function isChinese(text: string): boolean {
  return /[\u4e00-\u9fff]/.test(text);
}

/** 带超时的 fetch，返回 JSON */
async function fetchJson(url: string, timeoutMs = 8000): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`接口返回 HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** 并行竞争：返回第一个成功的结果（其余失败不影响） */
function raceFirst<T>(tasks: (() => Promise<T>)[]): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let pending = tasks.length;
    tasks.forEach((t) =>
      t().then(
        (v) => {
          if (!settled) {
            settled = true;
            resolve(v);
          }
        },
        () => {
          pending--;
          if (pending === 0 && !settled) {
            settled = true;
            reject(new Error('翻译接口均不可用，请稍后重试'));
          }
        },
      ),
    );
  });
}

/** Google Translate 免费端点 */
async function translateWithGoogle(text: string, sl: string, tl: string): Promise<string> {
  const url =
    `https://translate.googleapis.com/translate_a/single?client=gtx` +
    `&sl=${encodeURIComponent(sl)}&tl=${encodeURIComponent(tl)}&dt=t&q=${encodeURIComponent(text)}`;
  const data = await fetchJson(url);
  const segs = data?.[0] ?? [];
  const out = segs.map((s: any) => (s && s[0]) || '').join('');
  if (!out) throw new Error('Google 返回为空');
  return out;
}

/** MyMemory 免费端点（兜底） */
async function translateWithMyMemory(text: string, sl: string, tl: string): Promise<string> {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sl}|${tl}`;
  const data = await fetchJson(url);
  const out = data?.responseData?.translatedText;
  if (out) return out;
  throw new Error(data?.responseStatus ? `MyMemory 状态码 ${data.responseStatus}` : '翻译结果为空');
}

/** 主翻译：Google 与 MyMemory 并行竞争，谁先返回用谁 */
async function translate(text: string, sl: string, tl: string): Promise<string> {
  return raceFirst([
    () => translateWithGoogle(text, sl, tl),
    () => translateWithMyMemory(text, sl, tl),
  ]);
}

/** 选取与目标语言匹配的语音 */
function pickVoice(lang: string): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis?.getVoices?.() ?? [];
  return voices.find((v) => v.lang.toLowerCase() === lang) ?? null;
}

/** 朗读文本 */
function speak(text: string, lang: string) {
  try {
    if (!('speechSynthesis' in window)) {
      message.warning('当前浏览器不支持语音合成');
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = 0.92;
    const voice = pickVoice(lang);
    if (voice) u.voice = voice;
    window.speechSynthesis.speak(u);
  } catch {
    message.warning('语音播放失败');
  }
}

/** 转驼峰：按非字母数字切分，首词小写，其余首字母大写 */
function toCamelCase(s: string): string {
  const words = s.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  if (words.length === 0) return s;
  return (
    words[0].toLowerCase() +
    words
      .slice(1)
      .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
      .join('')
  );
}

/** 离线英汉词典：{ word: [音标, 释义文本] } */
type DictEntry = [string, string];
const DICT = engDict as unknown as Record<string, DictEntry>;

/** 历史记录 */
interface HistItem {
  src: string;
  dst: string;
  dir: string;
  t: number;
}
const HIST_KEY = 'tools:translate:history';
const HIST_MAX = 50;

const TranslatorTool: React.FC = () => {
  const { colors } = useTheme();
  const [mode, setMode] = useState<Direction>('auto');
  const [caseMode, setCaseMode] = useState<CaseMode>('original');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<HistItem[]>(() => storage.get<HistItem[]>(HIST_KEY) ?? []);
  const cacheRef = useRef(new Map<string, string>());

  /** 解析源/目标语言，返回语向标签 */
  const resolve = (text: string): { sl: string; tl: string; dir: string } => {
    if (mode === 'zh2en') return { sl: 'zh-CN', tl: 'en', dir: '中→英' };
    if (mode === 'en2zh') return { sl: 'en', tl: 'zh-CN', dir: '英→中' };
    return isChinese(text)
      ? { sl: 'zh-CN', tl: 'en', dir: '中→英' }
      : { sl: 'en', tl: 'zh-CN', dir: '英→中' };
  };

  const saveHistory = (list: HistItem[]) => {
    const capped = list.slice(0, HIST_MAX);
    setHistory(capped);
    storage.set(HIST_KEY, capped);
  };

  const run = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text) return;
    const { sl, tl, dir } = resolve(text);
    const key = `${sl}|${tl}|${text}`;
    const cached = cacheRef.current.get(key);
    setLoading(true);
    try {
      const result = cached ?? (await translate(text, sl, tl));
      if (!cached) {
        if (cacheRef.current.size > 60) cacheRef.current.clear();
        cacheRef.current.set(key, result);
      }
      setOutput(result);
      if (textOverride !== undefined) setInput(textOverride);
      saveHistory([
        { src: text, dst: result, dir, t: Date.now() },
        ...history.filter((h) => !(h.src === text && h.dst === result)),
      ]);
    } catch (e: any) {
      message.error(e?.message || '翻译失败，请检查网络后重试');
    } finally {
      setLoading(false);
    }
  };

  const swap = () => {
    if (mode === 'auto') return;
    setMode(mode === 'zh2en' ? 'en2zh' : 'zh2en');
    setInput(output);
    setOutput(input);
  };

  const copy = () => {
    if (!displayOutput) return;
    navigator.clipboard.writeText(displayOutput);
    message.success('已复制');
  };

  const clearHistory = () => {
    saveHistory([]);
    message.success('历史已清空');
  };

  /** 历史弹层内容 */
  const historyContent = (
    <div style={{ width: 300 }}>
      {history.length === 0 ? (
        <div style={{ padding: '12px 0', textAlign: 'center', color: colors.textSecondary, fontSize: 13 }}>
          暂无翻译历史
        </div>
      ) : (
        <>
          <div style={{ maxHeight: 280, overflowY: 'auto' }}>
            {history.map((h, i) => (
              <div
                key={i}
                onClick={() => {
                  setInput(h.src);
                  setOutput(h.dst);
                }}
                title="点击恢复该条记录"
                style={{
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  borderBottom: `1px solid ${colors.border}`,
                }}
              >
                <div style={{ fontSize: 13, color: colors.text }}>{h.src}</div>
                <div style={{ fontSize: 12, color: colors.textSecondary }}>{h.dst}</div>
                <div style={{ fontSize: 11, color: colors.textSecondary, opacity: 0.7, marginTop: 2 }}>
                  {h.dir} ·{' '}
                  {new Date(h.t).toLocaleString('zh-CN', {
                    month: 'numeric',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <span style={{ fontSize: 12, color: colors.textSecondary }}>共 {history.length} 条</span>
            <Button size="small" danger icon={<Icon icon={trashIcon} width={12} />} onClick={clearHistory}>
              清空
            </Button>
          </div>
        </>
      )}
    </div>
  );

  const inputLang = isChinese(input) ? 'zh-CN' : 'en-US';
  const outputLang = output ? (isChinese(output) ? 'zh-CN' : 'en-US') : '';
  const pinyinText = isChinese(input) ? pinyin(input, { toneType: 'symbol' }) : '';

  /** 按大小写模式得到译文展示文本 */
  const displayOutput = useMemo(() => {
    if (!output) return '';
    switch (caseMode) {
      case 'lower':
        return output.toLowerCase();
      case 'upper':
        return output.toUpperCase();
      case 'camel':
        return toCamelCase(output);
      default:
        return output;
    }
  }, [output, caseMode]);

  /** 译文是单个英文单词时查离线词典 */
  const dictWord = useMemo(() => {
    const word = output.trim().toLowerCase();
    if (!/^[a-zA-Z][a-zA-Z'\-]*$/.test(word) || word.length > 32) return null;
    return word;
  }, [output]);
  const dictEntry: DictEntry | null = dictWord ? (DICT[dictWord] ?? null) : null;
  const dictMissing = dictWord !== null && !dictEntry;

  const renderToolbar = (label: string, lang: string, onSpeak: () => void, extra?: React.ReactNode) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
      <span style={{ fontSize: 12, color: colors.textSecondary }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {extra}
        <Tooltip title="朗读发音">
          <Button size="small" type="text" icon={<Icon icon={volumeIcon} width={14} />} onClick={onSpeak} />
        </Tooltip>
      </div>
    </div>
  );

  return (
    <ToolShell
      title="中英翻译"
      description="中英互译，带拼音、词典释义与历史记录，支持发音朗读与大小写切换"
      fillHeight
      actions={
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Radio.Group size="small" value={mode} onChange={(e) => setMode(e.target.value)}>
            <Radio.Button value="auto">自动</Radio.Button>
            <Radio.Button value="zh2en">中→英</Radio.Button>
            <Radio.Button value="en2zh">英→中</Radio.Button>
          </Radio.Group>
          <Tooltip title={mode === 'auto' ? '自动模式无需切换' : '交换源/结果并反转方向'}>
            <Button size="small" icon={<Icon icon={swapIcon} width={14} />} onClick={swap} disabled={mode === 'auto'} />
          </Tooltip>
          <Popover content={historyContent} title="翻译历史" trigger="click" placement="bottomRight">
            <Button size="small" icon={<Icon icon={historyIcon} width={14} />}>
              {history.length > 0 ? `历史(${history.length})` : '历史'}
            </Button>
          </Popover>
          <Button size="small" type="primary" onClick={() => run()} loading={loading} disabled={!input.trim()}>
            翻译
          </Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, flex: 1, minHeight: 180 }}>
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {renderToolbar('原文', inputLang, () => input && speak(input, inputLang))}
            <Input.TextArea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="输入要翻译的中文或英文"
              style={{ flex: 1, minHeight: 0, fontSize: 14, resize: 'none' }}
            />
            {pinyinText && (
              <div style={{ fontSize: 13, color: colors.textSecondary, marginTop: 6 }}>{pinyinText}</div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {renderToolbar('译文', outputLang, () => displayOutput && speak(displayOutput, isChinese(displayOutput) ? 'zh-CN' : 'en-US'), (
              <Button size="small" type="text" icon={<Icon icon={copyIcon} width={14} />} onClick={copy} disabled={!displayOutput} />
            ))}
            <Input.TextArea
              value={displayOutput}
              readOnly
              placeholder="翻译结果将显示在这里"
              style={{ flex: 1, minHeight: 0, fontSize: 14, resize: 'none' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginTop: 6, gap: 8 }}>
              <Segmented
                size="small"
                value={caseMode}
                onChange={(v) => setCaseMode(v as CaseMode)}
                options={[
                  { label: '原样', value: 'original' },
                  { label: '小写', value: 'lower' },
                  { label: '大写', value: 'upper' },
                  { label: '驼峰', value: 'camel' },
                ]}
              />
            </div>

            {/* 定义和其他翻译：仅当译文是单个英文单词时显示 */}
            {dictEntry && (
              <div
                style={{
                  marginTop: 8,
                  padding: '10px 14px',
                  background: colors.surface,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 'var(--radius-sm)',
                  maxHeight: 200,
                  overflowY: 'auto',
                  flexShrink: 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{dictWord}</span>
                  {dictEntry[0] && <span style={{ fontSize: 12, color: colors.textSecondary }}>/ {dictEntry[0]} /</span>}
                  <span style={{ fontSize: 12, color: colors.textSecondary, marginLeft: 'auto' }}>定义和其他翻译</span>
                </div>
                {dictEntry[1]
                  .split('\n')
                  .filter((l) => l.trim())
                  .map((line, i) => {
                    const m = line.match(/^([a-z]+\.)\s*(.*)$/i);
                    return (
                      <div key={i} style={{ marginBottom: 5 }}>
                        {m ? (
                          <>
                            <span style={{ fontSize: 12, color: colors.textSecondary, marginRight: 4 }}>{m[1]}</span>
                            <span style={{ fontSize: 13, color: colors.text }}>{m[2]}</span>
                          </>
                        ) : (
                          <span style={{ fontSize: 13, color: colors.text }}>{line}</span>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
            {dictMissing && (
              <div
                style={{
                  marginTop: 8,
                  padding: '8px 12px',
                  fontSize: 12,
                  color: colors.textSecondary,
                  border: `1px dashed ${colors.border}`,
                  borderRadius: 'var(--radius-sm)',
                  flexShrink: 0,
                }}
              >
                离线词典未收录 “{dictWord}”
              </div>
            )}
          </div>
        </div>
      </div>
    </ToolShell>
  );
};

export default TranslatorTool;
