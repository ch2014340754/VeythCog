/* ========================================
   背景功能：内置图库 + 自定义 URL
   存储值格式：
     - 'none'                无背景（默认纯色）
     - 'preset:<id>'         内置背景（渐变 / 真实壁纸图片）
     - 'url:<图片地址>'      自定义图片 URL
   ======================================== */

/** 存储值：'none' | 'preset:<id>' | 'url:<地址>' */
export type BackgroundValue = string;

/** 遮罩强度（对自定义 URL 与内置壁纸图片生效，保证任何图都清晰可读） */
export type OverlayStrength = 'soft' | 'medium' | 'deep';

export interface BuiltinBackground {
  id: string;
  label: string;
  /** gradient：light/dark 渐变；image：真实壁纸图片 */
  type: 'gradient' | 'image';
  /** 亮色背景（渐变 CSS 或图片 URL） */
  light: string;
  /** 暗色背景（渐变 CSS；图片类型忽略） */
  dark: string;
  /** image 类型的图片 URL（相对站点根） */
  image?: string;
  /** 设置页缩略图主色点（渐变用；图片类型可给近似主色） */
  swatch: [string, string, string];
}

/** 内置背景库 —— 渐变（简约精致、零加载）+ 真实壁纸（高清晰度 WEBP） */
export const BUILTIN_BACKGROUNDS: BuiltinBackground[] = [
  {
    id: 'aurora',
    label: '朝雾',
    type: 'gradient',
    light: [
      'radial-gradient(1200px 800px at 12% 8%, rgba(167, 139, 250, 0.22), transparent 55%)',
      'radial-gradient(1000px 700px at 88% 12%, rgba(244, 114, 182, 0.14), transparent 55%)',
      'radial-gradient(900px 900px at 50% 100%, rgba(124, 58, 237, 0.10), transparent 60%)',
      'linear-gradient(160deg, #F6F3FF 0%, #FDF4FB 55%, #F3F1FE 100%)',
    ].join(', '),
    dark: [
      'radial-gradient(1200px 800px at 12% 8%, rgba(167, 139, 250, 0.20), transparent 55%)',
      'radial-gradient(1000px 700px at 88% 12%, rgba(244, 114, 182, 0.12), transparent 55%)',
      'radial-gradient(900px 900px at 50% 100%, rgba(76, 29, 149, 0.35), transparent 60%)',
      'linear-gradient(160deg, #1B1230 0%, #221532 55%, #140F2B 100%)',
    ].join(', '),
    swatch: ['#D8CCFF', '#7C3AED', '#3B0764'],
  },
  {
    id: 'lagoon',
    label: '潟湖',
    type: 'gradient',
    light: [
      'radial-gradient(1200px 800px at 10% 10%, rgba(56, 189, 248, 0.16), transparent 55%)',
      'radial-gradient(1000px 700px at 90% 5%, rgba(45, 212, 191, 0.14), transparent 55%)',
      'radial-gradient(900px 900px at 55% 100%, rgba(59, 130, 246, 0.10), transparent 60%)',
      'linear-gradient(160deg, #F0F9FF 0%, #ECFEFF 55%, #EFF6FF 100%)',
    ].join(', '),
    dark: [
      'radial-gradient(1200px 800px at 10% 10%, rgba(56, 189, 248, 0.16), transparent 55%)',
      'radial-gradient(1000px 700px at 90% 5%, rgba(45, 212, 191, 0.10), transparent 55%)',
      'radial-gradient(900px 900px at 55% 100%, rgba(30, 64, 175, 0.30), transparent 60%)',
      'linear-gradient(160deg, #0B1526 0%, #0C2230 55%, #0A1020 100%)',
    ].join(', '),
    swatch: ['#BFE7FF', '#0EA5E9', '#0C4A6E'],
  },
  {
    id: 'sand',
    label: '暖砂',
    type: 'gradient',
    light: [
      'radial-gradient(1200px 800px at 12% 8%, rgba(251, 191, 36, 0.16), transparent 55%)',
      'radial-gradient(1000px 700px at 88% 12%, rgba(249, 115, 22, 0.12), transparent 55%)',
      'radial-gradient(900px 900px at 50% 100%, rgba(180, 83, 9, 0.08), transparent 60%)',
      'linear-gradient(160deg, #FFFBF0 0%, #FEF7EC 55%, #FFF6E8 100%)',
    ].join(', '),
    dark: [
      'radial-gradient(1200px 800px at 12% 8%, rgba(251, 191, 36, 0.14), transparent 55%)',
      'radial-gradient(1000px 700px at 88% 12%, rgba(249, 115, 22, 0.10), transparent 55%)',
      'radial-gradient(900px 900px at 50% 100%, rgba(120, 53, 15, 0.32), transparent 60%)',
      'linear-gradient(160deg, #241B10 0%, #2A2114 55%, #1D170E 100%)',
    ].join(', '),
    swatch: ['#FFE7B8', '#F59E0B', '#78350F'],
  },
  {
    id: 'mint',
    label: '薄荷',
    type: 'gradient',
    light: [
      'radial-gradient(1200px 800px at 12% 8%, rgba(52, 211, 153, 0.14), transparent 55%)',
      'radial-gradient(1000px 700px at 88% 12%, rgba(16, 185, 129, 0.12), transparent 55%)',
      'radial-gradient(900px 900px at 50% 100%, rgba(20, 184, 166, 0.08), transparent 60%)',
      'linear-gradient(160deg, #F1FBF7 0%, #ECFCF5 55%, #EFFAF6 100%)',
    ].join(', '),
    dark: [
      'radial-gradient(1200px 800px at 12% 8%, rgba(52, 211, 153, 0.14), transparent 55%)',
      'radial-gradient(1000px 700px at 88% 12%, rgba(16, 185, 129, 0.10), transparent 55%)',
      'radial-gradient(900px 900px at 50% 100%, rgba(6, 95, 70, 0.32), transparent 60%)',
      'linear-gradient(160deg, #0E241C 0%, #0F2A21 55%, #0B1E19 100%)',
    ].join(', '),
    swatch: ['#C7F4DE', '#10B981', '#064E3B'],
  },
  {
    id: 'dusk',
    label: '暮色',
    type: 'gradient',
    light: [
      'radial-gradient(1200px 800px at 12% 8%, rgba(129, 140, 248, 0.16), transparent 55%)',
      'radial-gradient(1000px 700px at 88% 12%, rgba(217, 70, 239, 0.10), transparent 55%)',
      'radial-gradient(900px 900px at 50% 100%, rgba(79, 70, 229, 0.12), transparent 60%)',
      'linear-gradient(160deg, #F4F3FF 0%, #F5F0FF 55%, #EEF0FF 100%)',
    ].join(', '),
    dark: [
      'radial-gradient(1200px 800px at 12% 8%, rgba(129, 140, 248, 0.20), transparent 55%)',
      'radial-gradient(1000px 700px at 88% 12%, rgba(217, 70, 239, 0.12), transparent 55%)',
      'radial-gradient(900px 900px at 50% 100%, rgba(67, 56, 202, 0.35), transparent 60%)',
      'linear-gradient(160deg, #10122A 0%, #151030 55%, #0D0F24 100%)',
    ].join(', '),
    swatch: ['#D6D5FF', '#6366F1', '#3730A3'],
  },
  // ---- 真实壁纸（高清晰度 WEBP，保持原分辨率） ----
  {
    id: 'ruin',
    label: '废墟',
    type: 'image',
    image: '/backgrounds/ruin.webp',
    light: '',
    dark: '',
    swatch: ['#5b5b5b', '#2b2b2b', '#0a0a0a'],
  },
  {
    id: 'silhouette',
    label: '剪影',
    type: 'image',
    image: '/backgrounds/silhouette.webp',
    light: '',
    dark: '',
    swatch: ['#f4a94b', '#c56a2e', '#1c1c1c'],
  },
  {
    id: 'mythic',
    label: '焚天',
    type: 'image',
    image: '/backgrounds/mythic.webp',
    light: '',
    dark: '',
    swatch: ['#ff6a3d', '#a63a2a', '#140f0b'],
  },
  {
    id: 'orient',
    label: '东方',
    type: 'image',
    image: '/backgrounds/orient.webp',
    light: '',
    dark: '',
    swatch: ['#e8d5b0', '#8a6a4a', '#2a2018'],
  },
];

export const OVERLAY_STRENGTHS: { key: OverlayStrength; label: string }[] = [
  { key: 'soft', label: '浅' },
  { key: 'medium', label: '中' },
  { key: 'deep', label: '深' },
];

/** 解析存储值 */
export function parseBackground(value: BackgroundValue): {
  kind: 'none' | 'preset' | 'url';
  id?: string;
  url?: string;
} {
  if (!value || value === 'none') return { kind: 'none' };
  if (value.startsWith('preset:')) {
    return { kind: 'preset', id: value.slice('preset:'.length) };
  }
  if (value.startsWith('url:')) {
    return { kind: 'url', url: value.slice('url:'.length) };
  }
  return { kind: 'none' };
}

/** 计算遮罩颜色（对自定义 URL 与内置壁纸图片生效） */
function overlayColor(overlay: OverlayStrength, isDark: boolean): string {
  const map: Record<OverlayStrength, [string, string]> = {
    soft: ['rgba(255, 255, 255, 0.42)', 'rgba(0, 0, 0, 0.50)'],
    medium: ['rgba(255, 255, 255, 0.58)', 'rgba(0, 0, 0, 0.65)'],
    deep: ['rgba(255, 255, 255, 0.72)', 'rgba(0, 0, 0, 0.80)'],
  };
  const pair = map[overlay];
  return isDark ? pair[1] : pair[0];
}

/** 解析出最终背景渲染参数 */
export function resolveBackground(
  value: BackgroundValue,
  isDark: boolean,
  overlay: OverlayStrength,
): { active: boolean; css: string; overlay: string } {
  const { kind, id, url } = parseBackground(value);

  if (kind === 'preset' && id) {
    const preset = BUILTIN_BACKGROUNDS.find((b) => b.id === id);
    if (preset) {
      // 真实壁纸图片：用图片 + 遮罩（响应遮罩强度，保证可读性）
      if (preset.type === 'image' && preset.image) {
        return {
          active: true,
          css: `url("${preset.image}")`,
          overlay: overlayColor(overlay, isDark),
        };
      }
      // 渐变：不加遮罩，天然通透
      return {
        active: true,
        css: isDark ? preset.dark : preset.light,
        overlay: 'transparent',
      };
    }
  }

  if (kind === 'url' && url) {
    return {
      active: true,
      css: `url("${url}")`,
      overlay: overlayColor(overlay, isDark),
    };
  }

  return { active: false, css: '', overlay: 'transparent' };
}
