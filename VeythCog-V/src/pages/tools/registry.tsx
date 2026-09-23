import React from 'react';
import { Icon } from '@iconify/react';
// 内联导入 lucide 图标，直接打进 bundle，不依赖 Iconify 在线 API
import braces from '@iconify-icons/lucide/braces';
import fileCode from '@iconify-icons/lucide/file-code';
import gitFork from '@iconify-icons/lucide/git-fork';
import fileLock from '@iconify-icons/lucide/file-lock';
import linkIcon from '@iconify-icons/lucide/link';
import hexagon from '@iconify-icons/lucide/hexagon';
import keyRound from '@iconify-icons/lucide/key-round';
import hashIcon from '@iconify-icons/lucide/hash';
import regexIcon from '@iconify-icons/lucide/regex';
import caseSensitive from '@iconify-icons/lucide/case-sensitive';
import gitCompare from '@iconify-icons/lucide/git-compare-arrows';
import textIcon from '@iconify-icons/lucide/file-text';
import listChecks from '@iconify-icons/lucide/list-checks';
import replaceIcon from '@iconify-icons/lucide/replace';
import clockIcon from '@iconify-icons/lucide/clock';
import globeIcon from '@iconify-icons/lucide/globe';
import databaseIcon from '@iconify-icons/lucide/database';
import terminalIcon from '@iconify-icons/lucide/terminal';
import alarmClock from '@iconify-icons/lucide/alarm-clock';
import fingerprint from '@iconify-icons/lucide/fingerprint';
import shieldCheck from '@iconify-icons/lucide/shield-check';
import binaryIcon from '@iconify-icons/lucide/binary';
import paletteIcon from '@iconify-icons/lucide/palette';
import imageIcon from '@iconify-icons/lucide/image';

/** 工具分类 */
export type ToolCategory = 'JSON' | '编码' | '哈希' | '文本' | '时间' | '代码' | '其他';

export interface ToolEntry {
  id: string;
  name: string;
  description: string;
  /** 内联图标 SVG 数据 */
  icon: React.ReactNode;
  category: ToolCategory;
  component: React.LazyExoticComponent<React.ComponentType>;
}

export const tools: ToolEntry[] = [
  // ---- JSON ----
  {
    id: 'json-formatter',
    name: 'JSON 格式化',
    description: '格式化、压缩、校验 JSON，错误定位到行列',
    icon: <Icon icon={braces} width={16} />,
    category: 'JSON',
    component: React.lazy(() => import('./tools/JsonFormatter')),
  },
  {
    id: 'json-yaml',
    name: 'JSON ↔ YAML',
    description: 'JSON 和 YAML 互转',
    icon: <Icon icon={fileCode} width={16} />,
    category: 'JSON',
    component: React.lazy(() => import('./tools/JsonYaml')),
  },
  {
    id: 'json-path',
    name: 'JSONPath 求值',
    description: '输入 $.a.b[0] 实时提取结果',
    icon: <Icon icon={gitFork} width={16} />,
    category: 'JSON',
    component: React.lazy(() => import('./tools/JsonPathTool')),
  },

  // ---- 编码 ----
  {
    id: 'base64',
    name: 'Base64 编解码',
    description: '文本/文件 Base64 互转，支持中文',
    icon: <Icon icon={fileLock} width={16} />,
    category: '编码',
    component: React.lazy(() => import('./tools/Base64Tool')),
  },
  {
    id: 'url-encoder',
    name: 'URL 编解码',
    description: 'encodeURI / decodeURI 一键互转',
    icon: <Icon icon={linkIcon} width={16} />,
    category: '编码',
    component: React.lazy(() => import('./tools/UrlEncoder')),
  },
  {
    id: 'hex',
    name: 'Hex 编解码',
    description: '文本与十六进制互转',
    icon: <Icon icon={hexagon} width={16} />,
    category: '编码',
    component: React.lazy(() => import('./tools/HexTool')),
  },
  {
    id: 'jwt-decode',
    name: 'JWT 解码',
    description: '解析 header / payload，不验签',
    icon: <Icon icon={keyRound} width={16} />,
    category: '编码',
    component: React.lazy(() => import('./tools/JwtDecode')),
  },

  // ---- 哈希 ----
  {
    id: 'hash',
    name: '哈希计算',
    description: 'MD5 / SHA1 / SHA256 / SHA512',
    icon: <Icon icon={hashIcon} width={16} />,
    category: '哈希',
    component: React.lazy(() => import('./tools/HashTool')),
  },

  // ---- 文本 ----
  {
    id: 'regex',
    name: '正则测试器',
    description: '实时高亮匹配、捕获组、常用正则',
    icon: <Icon icon={regexIcon} width={16} />,
    category: '文本',
    component: React.lazy(() => import('./tools/RegexTester')),
  },
  {
    id: 'case-converter',
    name: '命名风格转换',
    description: 'camelCase / snake_case / PascalCase / kebab-case',
    icon: <Icon icon={caseSensitive} width={16} />,
    category: '文本',
    component: React.lazy(() => import('./tools/CaseConverter')),
  },
  {
    id: 'text-diff',
    name: '文本 Diff',
    description: '左右双栏对比，红绿标增删',
    icon: <Icon icon={gitCompare} width={16} />,
    category: '文本',
    component: React.lazy(() => import('./tools/TextDiff')),
  },
  {
    id: 'markdown-preview',
    name: 'Markdown 预览',
    description: '左边写右边实时渲染',
    icon: <Icon icon={textIcon} width={16} />,
    category: '文本',
    component: React.lazy(() => import('./tools/MarkdownPreview')),
  },
  {
    id: 'word-count',
    name: '字数统计 / 去重',
    description: '字数、行数、字符数，文本去重',
    icon: <Icon icon={listChecks} width={16} />,
    category: '文本',
    component: React.lazy(() => import('./tools/WordCount')),
  },
  {
    id: 'text-replace',
    name: '文本替换',
    description: '支持正则，替换结果高亮显示',
    icon: <Icon icon={replaceIcon} width={16} />,
    category: '文本',
    component: React.lazy(() => import('./tools/TextReplace')),
  },

  // ---- 时间 ----
  {
    id: 'timestamp',
    name: '时间戳转换',
    description: 'Unix 秒/毫秒 ↔ 本地时间',
    icon: <Icon icon={clockIcon} width={16} />,
    category: '时间',
    component: React.lazy(() => import('./tools/TimestampTool')),
  },
  {
    id: 'timezone',
    name: '时区转换',
    description: '两个时区时间对表',
    icon: <Icon icon={globeIcon} width={16} />,
    category: '时间',
    component: React.lazy(() => import('./tools/TimezoneTool')),
  },

  // ---- 代码 ----
  {
    id: 'sql-formatter',
    name: 'SQL 格式化',
    description: '关键字大写、缩进、美化',
    icon: <Icon icon={databaseIcon} width={16} />,
    category: '代码',
    component: React.lazy(() => import('./tools/SqlFormatter')),
  },
  {
    id: 'curl-convert',
    name: 'cURL 转代码',
    description: '粘贴 cURL 生成 fetch / axios',
    icon: <Icon icon={terminalIcon} width={16} />,
    category: '代码',
    component: React.lazy(() => import('./tools/CurlConvert')),
  },
  {
    id: 'cron',
    name: 'Cron 解释',
    description: '表达式翻译成中文，预览下次执行时间',
    icon: <Icon icon={alarmClock} width={16} />,
    category: '代码',
    component: React.lazy(() => import('./tools/CronExplainer')),
  },

  // ---- 其他 ----
  {
    id: 'uuid',
    name: 'UUID 生成',
    description: '批量生成 v4 UUID',
    icon: <Icon icon={fingerprint} width={16} />,
    category: '其他',
    component: React.lazy(() => import('./tools/UuidTool')),
  },
  {
    id: 'password',
    name: '密码生成器',
    description: '长度、符号、大小写可选',
    icon: <Icon icon={shieldCheck} width={16} />,
    category: '其他',
    component: React.lazy(() => import('./tools/PasswordTool')),
  },
  {
    id: 'base-converter',
    name: '进制转换',
    description: '二/八/十/十六进制互转',
    icon: <Icon icon={binaryIcon} width={16} />,
    category: '其他',
    component: React.lazy(() => import('./tools/BaseConverter')),
  },
  {
    id: 'color',
    name: '颜色转换',
    description: 'HEX ↔ RGB ↔ HSL，带取色器',
    icon: <Icon icon={paletteIcon} width={16} />,
    category: '其他',
    component: React.lazy(() => import('./tools/ColorTool')),
  },
  {
    id: 'image-base64',
    name: '图片转 Base64',
    description: '拖拽图片生成 data URL',
    icon: <Icon icon={imageIcon} width={16} />,
    category: '其他',
    component: React.lazy(() => import('./tools/ImageBase64')),
  },
];

export const categoryOrder: ToolCategory[] = ['JSON', '编码', '哈希', '文本', '时间', '代码', '其他'];

export function groupToolsByCategory(): { category: ToolCategory; items: ToolEntry[] }[] {
  return categoryOrder
    .map((category) => ({
      category,
      items: tools.filter((t) => t.category === category),
    }))
    .filter((g) => g.items.length > 0);
}
