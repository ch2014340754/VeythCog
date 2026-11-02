import React, { useState } from 'react';
import { Input, Button, Radio, Switch, message } from 'antd';
import { Icon } from '@iconify/react';
import copyIcon from '@iconify-icons/lucide/copy';
import checkIcon from '@iconify-icons/lucide/check';
import ToolShell from '../ToolShell';
import { useTheme } from '@/contexts/ThemeContext';

type ShellType = 'bash' | 'powershell' | 'cmd';
type Direction = 'merge' | 'wrap';

/** 各 shell 的行尾续行符 */
const CONTINUATION: Record<ShellType, string> = {
  bash: '\\',
  powershell: '`',
  cmd: '^',
};

/** 续行符在正则里的转义写法 */
const CONT_ESC: Record<ShellType, string> = {
  bash: '\\\\',
  powershell: '`',
  cmd: '\\^',
};

/** 去除一行开头的 shell 提示符前缀（$ / # / PS> / C:\> 等） */
function stripPrompt(line: string, shell: ShellType): string {
  const leading = line.match(/^\s*/)?.[0] ?? '';
  let rest = line.slice(leading.length);
  if (shell === 'powershell') {
    rest = rest.replace(/^PS[^>]*>\s*/, '');
  } else if (shell === 'cmd') {
    rest = rest.replace(/^[A-Za-z]:[\\/][^>]*>\s*/, '');
  } else {
    rest = rest.replace(/^[#$>]\s*/, '');
  }
  return leading + rest;
}

/** 多行命令 → 单行：去掉行尾续行符，剩余换行视为空格 */
function collapseCmd(input: string, shell: ShellType, strip: boolean): string {
  let text = input;
  if (strip) text = text.split('\n').map((l) => stripPrompt(l, shell)).join('\n');
  // 去掉「续行符 + 换行」
  let out = text.replace(new RegExp(CONT_ESC[shell] + '[ \\t]*\\r?\\n', 'g'), ' ');
  // 剩余裸换行统一视为空格
  out = out.replace(/\r?\n/g, ' ');
  // 规整连续空白并收尾
  out = out.replace(/[ \t]+/g, ' ').trim();
  return out;
}

/** 按空白拆分 token，同时保留带引号的完整片段（含引号） */
function tokenize(s: string): string[] {
  const tokens: string[] = [];
  let cur = '';
  let quote: string | null = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quote) {
      cur += c;
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") {
      if (cur) tokens.push(cur);
      cur = c;
      quote = c;
    } else if (/\s/.test(c)) {
      if (cur) tokens.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  if (cur) tokens.push(cur);
  return tokens;
}

/** 单行命令 → 多行：按宽度折行，每行结尾加续行符（最后一行不加） */
function wrapCmd(input: string, shell: ShellType, width: number, strip: boolean): string {
  let text = input.trim();
  if (strip) text = text.split('\n').map((l) => stripPrompt(l, shell)).join('\n');
  text = text.replace(/\r?\n/g, ' ').replace(/[ \t]+/g, ' ').trim();
  const tokens = tokenize(text);
  const cont = CONTINUATION[shell];
  const lines: string[] = [];
  let line = '';
  for (const tok of tokens) {
    const candidate = line ? line + ' ' + tok : tok;
    if (line && candidate.length > width) {
      lines.push(line + ' ' + cont);
      line = tok;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.join('\n');
}

const CommandLineWrap: React.FC = () => {
  const { colors } = useTheme();
  const [shell, setShell] = useState<ShellType>('bash');
  const [direction, setDirection] = useState<Direction>('merge');
  const [strip, setStrip] = useState(true);
  const [width, setWidth] = useState<number>(80);
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [copied, setCopied] = useState(false);

  const run = () => {
    if (!input.trim()) {
      setOutput('');
      return;
    }
    try {
      const out =
        direction === 'merge'
          ? collapseCmd(input, shell, strip)
          : wrapCmd(input, shell, width, strip);
      setOutput(out);
    } catch (e: any) {
      setOutput('转换失败：' + e.message);
    }
  };

  const copy = async () => {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    message.success('已复制');
    setTimeout(() => setCopied(false), 1500);
  };

  const inLines = input ? input.split('\n').length : 0;
  const outLines = output ? output.split('\n').length : 0;

  return (
    <ToolShell
      title="命令行换行处理"
      description="多行命令合并为单行，或长命令按续行符排版，解决粘贴触发多行警告的问题"
      fillHeight
      actions={
        <>
          <Radio.Group size="small" value={shell} onChange={(e) => setShell(e.target.value)}>
            <Radio.Button value="bash">Bash/zsh</Radio.Button>
            <Radio.Button value="powershell">PowerShell</Radio.Button>
            <Radio.Button value="cmd">CMD</Radio.Button>
          </Radio.Group>
          <Radio.Group size="small" value={direction} onChange={(e) => setDirection(e.target.value)}>
            <Radio.Button value="merge">合并为单行</Radio.Button>
            <Radio.Button value="wrap">拆分为多行</Radio.Button>
          </Radio.Group>
          <Button size="small" type="primary" onClick={run} disabled={!input.trim()}>
            转换
          </Button>
          <Button
            size="small"
            onClick={copy}
            disabled={!output}
            icon={<Icon icon={copied ? checkIcon : copyIcon} width={14} />}
          >
            {copied ? '已复制' : '复制结果'}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, minHeight: 0 }}>
        {/* 选项行 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              color: colors.textSecondary,
              cursor: 'pointer',
            }}
          >
            <Switch size="small" checked={strip} onChange={setStrip} />
            去除提示符前缀
          </label>
          {direction === 'wrap' && (
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 13,
                color: colors.textSecondary,
              }}
            >
              每行宽度
              <Input
                type="number"
                size="small"
                min={20}
                max={500}
                value={width}
                onChange={(e) => setWidth(Number(e.target.value) || 80)}
                style={{ width: 90, fontFamily: "'JetBrains Mono', Consolas, monospace" }}
              />
            </label>
          )}
          {output && (
            <span style={{ fontSize: 12, color: colors.textTertiary }}>
              {inLines} 行 → {outLines} 行
            </span>
          )}
        </div>

        {/* 输入输出 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, flex: 1, minHeight: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>
              {direction === 'merge' ? '多行命令（带续行符）' : '长命令（单行）'}
            </div>
            <Input.TextArea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                direction === 'merge'
                  ? 'podman run -d \\\n--name pg-vector \\\n-p 127.0.0.1:5432:5432 \\\n-e POSTGRES_PASSWORD=123456'
                  : 'podman run -d --name pg-vector -p 127.0.0.1:5432:5432 -e POSTGRES_PASSWORD=123456'
              }
              style={{ flex: 1, minHeight: 0, fontFamily: "'JetBrains Mono', Consolas, monospace", fontSize: 13 }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>
              {direction === 'merge' ? '合并后（单行，可安全粘贴）' : '排版后（多行）'}
            </div>
            <Input.TextArea
              value={output}
              readOnly
              placeholder="点击「转换」生成结果"
              style={{
                flex: 1,
                minHeight: 0,
                fontFamily: "'JetBrains Mono', Consolas, monospace",
                fontSize: 13,
                color: colors.text,
              }}
            />
          </div>
        </div>
      </div>
    </ToolShell>
  );
};

export default CommandLineWrap;
