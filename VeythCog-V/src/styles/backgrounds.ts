/* ========================================
   背景兜底：纯色渐变（零加载）
   存储值格式：
     - 'none'                无背景（主题纯色）
     - 'preset:<id>'         内置渐变
   真实壁纸（S3）不走这里，由 wallpaperStore + ThemeContext 单独渲染
   ======================================== */

/** 存储值：'none' | 'preset:<id>' */
export type BackgroundValue = string;

export interface BuiltinBackground {
  id: string;
  label: string;
  /** 亮色渐变 */
  light: string;
  /** 暗色渐变 */
  dark: string;
  /** 设置页缩略图主色点 */
  swatch: [string, string, string];
}

/** 内置兜底渐变（简约精致、零加载） */
export const BUILTIN_BACKGROUNDS: BuiltinBackground[] = [
  {
    id: 'aurora',
    label: '朝雾',
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
];

/** 解析存储值 */
export function parseBackground(value: BackgroundValue): {
  kind: 'none' | 'preset';
  id?: string;
} {
  if (!value || value === 'none') return { kind: 'none' };
  if (value.startsWith('preset:')) {
    return { kind: 'preset', id: value.slice('preset:'.length) };
  }
  return { kind: 'none' };
}

/** 遮罩颜色：percent 为 0-100，0 表示不加遮罩；壁纸/视频上盖一层，保证文字可读 */
export function overlayColor(percent: number, isDark: boolean): string {
  const alpha = Math.min(1, Math.max(0, percent / 100));
  return isDark ? `rgba(0, 0, 0, ${alpha})` : `rgba(255, 255, 255, ${alpha})`;
}

/** 解析兜底背景渲染参数（仅渐变，无背景时返回 inactive） */
export function resolveBackground(
  value: BackgroundValue,
  isDark: boolean,
): { active: boolean; css: string } {
  const { kind, id } = parseBackground(value);
  if (kind === 'preset' && id) {
    const preset = BUILTIN_BACKGROUNDS.find((b) => b.id === id);
    if (preset) {
      return { active: true, css: isDark ? preset.dark : preset.light };
    }
  }
  return { active: false, css: '' };
}
