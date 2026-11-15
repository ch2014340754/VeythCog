import bookOpenIcon from '@iconify-icons/lucide/book-open';
import botIcon from '@iconify-icons/lucide/bot';
import bracesIcon from '@iconify-icons/lucide/braces';
import brainIcon from '@iconify-icons/lucide/brain';
import briefcaseIcon from '@iconify-icons/lucide/briefcase';
import calendarIcon from '@iconify-icons/lucide/calendar';
import cameraIcon from '@iconify-icons/lucide/camera';
import chartColumnIcon from '@iconify-icons/lucide/chart-column';
import clapperboardIcon from '@iconify-icons/lucide/clapperboard';
import clockIcon from '@iconify-icons/lucide/clock';
import cloudIcon from '@iconify-icons/lucide/cloud';
import codeXmlIcon from '@iconify-icons/lucide/code-xml';
import coffeeIcon from '@iconify-icons/lucide/coffee';
import cpuIcon from '@iconify-icons/lucide/cpu';
import databaseIcon from '@iconify-icons/lucide/database';
import flameIcon from '@iconify-icons/lucide/flame';
import filmIcon from '@iconify-icons/lucide/film';
import folderIcon from '@iconify-icons/lucide/folder';
import gamepadIcon from '@iconify-icons/lucide/gamepad-2';
import globeIcon from '@iconify-icons/lucide/globe';
import graduationCapIcon from '@iconify-icons/lucide/graduation-cap';
import headphonesIcon from '@iconify-icons/lucide/headphones';
import heartIcon from '@iconify-icons/lucide/heart';
import houseIcon from '@iconify-icons/lucide/house';
import imageIcon from '@iconify-icons/lucide/image';
import layersIcon from '@iconify-icons/lucide/layers';
import layoutTemplateIcon from '@iconify-icons/lucide/layout-template';
import leafIcon from '@iconify-icons/lucide/leaf';
import lightbulbIcon from '@iconify-icons/lucide/lightbulb';
import linkIcon from '@iconify-icons/lucide/link';
import mailIcon from '@iconify-icons/lucide/mail';
import messageCircleIcon from '@iconify-icons/lucide/message-circle';
import monitorIcon from '@iconify-icons/lucide/monitor';
import musicIcon from '@iconify-icons/lucide/music';
import notebookPenIcon from '@iconify-icons/lucide/notebook-pen';
import packageIcon from '@iconify-icons/lucide/package';
import paletteIcon from '@iconify-icons/lucide/palette';
import penLineIcon from '@iconify-icons/lucide/pen-line';
import planeIcon from '@iconify-icons/lucide/plane';
import rocketIcon from '@iconify-icons/lucide/rocket';
import serverIcon from '@iconify-icons/lucide/server';
import settingsIcon from '@iconify-icons/lucide/settings';
import shieldCheckIcon from '@iconify-icons/lucide/shield-check';
import shoppingBagIcon from '@iconify-icons/lucide/shopping-bag';
import smartphoneIcon from '@iconify-icons/lucide/smartphone';
import sparklesIcon from '@iconify-icons/lucide/sparkles';
import starIcon from '@iconify-icons/lucide/star';
import terminalIcon from '@iconify-icons/lucide/terminal';
import usersIcon from '@iconify-icons/lucide/users';
import wrenchIcon from '@iconify-icons/lucide/wrench';
import type { IconifyIcon } from '@iconify/react';

/**
 * 分类图标的"纯色化"映射。
 *
 * 分类的 icon 在库里是自由文本（早期约定输入 emoji，例如 🏠 / 🛠，也有人直接敲 `</>`），
 * 首屏右栏原先直接把它当字符渲染，结果是一堆彩色 emoji 挤在玻璃板上，风格完全不受控。
 * 这里把「emoji / 文本 / 分类名」统一翻译成一套 Lucide 单色图标，
 * 颜色交给 CSS 的 currentColor（主题 primary）决定，所以明暗主题、换配色都会自动跟着走。
 */

const EMOJI_MAP: Record<string, IconifyIcon> = {
  '🏠': houseIcon,
  '🏡': houseIcon,
  '🏠️': houseIcon,
  '</>': codeXmlIcon,
  '🏷': folderIcon,
  '🎨': paletteIcon,
  '🖌': penLineIcon,
  '📚': bookOpenIcon,
  '📖': bookOpenIcon,
  '📝': notebookPenIcon,
  '🛠': wrenchIcon,
  '🔧': wrenchIcon,
  '⚙': settingsIcon,
  '⚙️': settingsIcon,
  '🎮': gamepadIcon,
  '🕹': gamepadIcon,
  '✨': sparklesIcon,
  '⭐': starIcon,
  '🌟': starIcon,
  '🤖': botIcon,
  '🧠': brainIcon,
  '💻': monitorIcon,
  '🖥': monitorIcon,
  '⌨': terminalIcon,
  '🧩': layersIcon,
  '🚀': rocketIcon,
  '☁': cloudIcon,
  '☁️': cloudIcon,
  '📦': packageIcon,
  '🔥': flameIcon,
  '🌐': globeIcon,
  '🎵': musicIcon,
  '🎧': musicIcon,
  '🎬': clapperboardIcon,
  '🎞': filmIcon,
  '🖼': imageIcon,
  '📷': cameraIcon,
  '📊': chartColumnIcon,
  '📈': chartColumnIcon,
  '🛡': shieldCheckIcon,
  '🔒': shieldCheckIcon,
  '🗄': databaseIcon,
  '🧱': databaseIcon,
  '💼': briefcaseIcon,
  '🎓': graduationCapIcon,
  '❤': heartIcon,
  '❤️': heartIcon,
  '🍀': leafIcon,
  '🌿': leafIcon,
  '☕': coffeeIcon,
  '🍵': coffeeIcon,
  '🛍': shoppingBagIcon,
  '🛒': shoppingBagIcon,
  '✈': planeIcon,
  '✈️': planeIcon,
  '💡': lightbulbIcon,
  '{ }': bracesIcon,
  '{}': bracesIcon,
};

/**
 * 分类管理弹窗里可选图标（50 个）。
 * `key` 就是写进数据库 `category.icon` 的值——不再让用户敲 emoji，
 * 而是选一个稳定的键名，渲染时由 ICON_BY_KEY 解析，换图标集也不会丢映射。
 */
export interface CategoryIconOption {
  key: string;
  label: string;
  icon: IconifyIcon;
}

export const CATEGORY_ICON_OPTIONS: CategoryIconOption[] = [
  { key: 'house', label: '主页', icon: houseIcon },
  { key: 'layout-template', label: '页面', icon: layoutTemplateIcon },
  { key: 'code-xml', label: '代码', icon: codeXmlIcon },
  { key: 'braces', label: '编程', icon: bracesIcon },
  { key: 'terminal', label: '终端', icon: terminalIcon },
  { key: 'server', label: '后端', icon: serverIcon },
  { key: 'database', label: '数据库', icon: databaseIcon },
  { key: 'cloud', label: '云服务', icon: cloudIcon },
  { key: 'cpu', label: '硬件', icon: cpuIcon },
  { key: 'layers', label: '架构', icon: layersIcon },
  { key: 'palette', label: '设计', icon: paletteIcon },
  { key: 'pen-line', label: '写作', icon: penLineIcon },
  { key: 'image', label: '图片', icon: imageIcon },
  { key: 'camera', label: '摄影', icon: cameraIcon },
  { key: 'film', label: '影视', icon: filmIcon },
  { key: 'clapperboard', label: '视频', icon: clapperboardIcon },
  { key: 'music', label: '音乐', icon: musicIcon },
  { key: 'headphones', label: '音频', icon: headphonesIcon },
  { key: 'gamepad-2', label: '游戏', icon: gamepadIcon },
  { key: 'sparkles', label: 'AI', icon: sparklesIcon },
  { key: 'book-open', label: '阅读', icon: bookOpenIcon },
  { key: 'notebook-pen', label: '笔记', icon: notebookPenIcon },
  { key: 'graduation-cap', label: '学习', icon: graduationCapIcon },
  { key: 'lightbulb', label: '灵感', icon: lightbulbIcon },
  { key: 'brain', label: '大模型', icon: brainIcon },
  { key: 'bot', label: '机器人', icon: botIcon },
  { key: 'rocket', label: '项目', icon: rocketIcon },
  { key: 'star', label: '收藏', icon: starIcon },
  { key: 'heart', label: '喜欢', icon: heartIcon },
  { key: 'flame', label: '热门', icon: flameIcon },
  { key: 'globe', label: '网络', icon: globeIcon },
  { key: 'wrench', label: '工具', icon: wrenchIcon },
  { key: 'settings', label: '设置', icon: settingsIcon },
  { key: 'shield-check', label: '安全', icon: shieldCheckIcon },
  { key: 'briefcase', label: '工作', icon: briefcaseIcon },
  { key: 'chart-column', label: '数据', icon: chartColumnIcon },
  { key: 'coffee', label: '生活', icon: coffeeIcon },
  { key: 'leaf', label: '自然', icon: leafIcon },
  { key: 'plane', label: '出行', icon: planeIcon },
  { key: 'shopping-bag', label: '购物', icon: shoppingBagIcon },
  { key: 'folder', label: '文件夹', icon: folderIcon },
  { key: 'package', label: '归档', icon: packageIcon },
  { key: 'monitor', label: '桌面', icon: monitorIcon },
  { key: 'smartphone', label: '移动端', icon: smartphoneIcon },
  { key: 'link', label: '链接', icon: linkIcon },
  { key: 'message-circle', label: '交流', icon: messageCircleIcon },
  { key: 'users', label: '团队', icon: usersIcon },
  { key: 'calendar', label: '日程', icon: calendarIcon },
  { key: 'clock', label: '时间', icon: clockIcon },
  { key: 'mail', label: '邮件', icon: mailIcon },
];

const ICON_BY_KEY: Record<string, IconifyIcon> = CATEGORY_ICON_OPTIONS.reduce(
  (acc, item) => {
    acc[item.key] = item.icon;
    return acc;
  },
  {} as Record<string, IconifyIcon>,
);

/** 按 key 取图标（选择器里预览用）；认不出返回文件夹图标 */
export function categoryIconByKey(key?: string | null): IconifyIcon {
  const k = normalize(key ?? '');
  return ICON_BY_KEY[k] ?? folderIcon;
}

const TOKEN_MAP: Record<string, IconifyIcon> = {
  code: codeXmlIcon,
  coding: codeXmlIcon,
  server: serverIcon,
  backend: serverIcon,
  frontend: layoutTemplateIcon,
  ui: layoutTemplateIcon,
  ux: layoutTemplateIcon,
  design: paletteIcon,
  ai: sparklesIcon,
  llm: brainIcon,
  ml: brainIcon,
  data: chartColumnIcon,
  db: databaseIcon,
  devops: cpuIcon,
  ops: cpuIcon,
  tool: wrenchIcon,
  tools: wrenchIcon,
  game: gamepadIcon,
  games: gamepadIcon,
  study: bookOpenIcon,
  learn: bookOpenIcon,
  doc: notebookPenIcon,
  docs: notebookPenIcon,
  note: notebookPenIcon,
  music: musicIcon,
  video: filmIcon,
  life: coffeeIcon,
  home: houseIcon,
};

/** 分类名兜底：库里 icon 是空的、或是没法认的字符时，按名字猜一个同义图标 */
const NAME_RULES: Array<[RegExp, IconifyIcon]> = [
  [/^(ai|人工智能|智能|大模型|ml|llm)/i, sparklesIcon],
  [/home|首页|主页|起始/i, houseIcon],
  [/后端|服务端|backend|server|接口|api|java|spring/i, serverIcon],
  [/前端|frontend|web|ui|界面|页面|react|vue/i, layoutTemplateIcon],
  [/学习|study|learn|课程|教程|知识/i, bookOpenIcon],
  [/工具|tool|实用|效率|util/i, wrenchIcon],
  [/游戏|game|娱乐/i, gamepadIcon],
  [/设计|design|视觉|美术|配色/i, paletteIcon],
  [/音乐|music|音频|播客/i, musicIcon],
  [/视频|video|影视|电影/i, filmIcon],
  [/数据|data|分析|统计|报表/i, chartColumnIcon],
  [/安全|security|网络|运维|devops/i, shieldCheckIcon],
  [/购物|消费|电商/i, shoppingBagIcon],
  [/生活|日常|life/i, coffeeIcon],
  [/阅读|读书|书籍|文档|笔记|note|doc/i, notebookPenIcon],
  [/工作|职场|work|项目|求职/i, briefcaseIcon],
  [/学习|school|考研|课程/i, graduationCapIcon],
];

const normalize = (value: string) => value.replace(/[\uFE0E\uFE0F]/g, '').trim();

/**
 * 取分类对应的单色图标。
 * @param icon 分类库里存的原始 icon 文本（emoji 或 `</>` 这类符号）
 * @param name 分类名，icon 认不出时用它兜底
 */
export function categoryIconFor(icon?: string | null, name?: string): IconifyIcon {
  const raw = normalize(icon ?? '');
  if (raw) {
    // 优先按"选择器写入的键名"解析（新分类都是这条路）
    if (ICON_BY_KEY[raw]) return ICON_BY_KEY[raw];
    if (EMOJI_MAP[raw]) return EMOJI_MAP[raw];
    const token = raw.toLowerCase();
    if (ICON_BY_KEY[token]) return ICON_BY_KEY[token];
    if (TOKEN_MAP[token]) return TOKEN_MAP[token];
    // 单字符 emoji 不在表里时，别退化成"没有图标"，按名字继续试
  }
  const label = (name ?? '').trim();
  if (label) {
    for (const [re, glyph] of NAME_RULES) {
      if (re.test(label)) return glyph;
    }
  }
  return folderIcon;
}
