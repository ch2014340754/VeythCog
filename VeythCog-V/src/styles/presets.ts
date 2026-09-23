import { ColorPreset, PresetName } from '@/types';

/**
 * 亮色预设：surface 统一白色系，不在这里指定
 */
const lightPresets: Record<PresetName, Omit<ColorPreset, 'name' | 'label' | 'surface' | 'surfaceElevated' | 'surfaceOverlay'>> = {
  amethyst: { primary: '#7C3AED', secondary: '#C4B5FD', cta: '#06B6D4', accent: '#FBBF24', bg: '#FAF5FF', text: '#1E1B4B', border: '#DDD6FE' },
  amber:    { primary: '#D97706', secondary: '#FCD34D', cta: '#06B6D4', accent: '#EF4444', bg: '#FFFBEB', text: '#451A03', border: '#FDE68A' },
  emerald:  { primary: '#059669', secondary: '#6EE7B7', cta: '#06B6D4', accent: '#F97316', bg: '#ECFDF5', text: '#022C22', border: '#A7F3D0' },
  indigo:   { primary: '#4F46E5', secondary: '#818CF8', cta: '#06B6D4', accent: '#F97316', bg: '#EEF2FF', text: '#1E1B4B', border: '#C7D2FE' },
  // rose 亮模式 accent 从白色改为琥珀，避免在浅粉底上不可见
  rose:     { primary: '#E11D48', secondary: '#FDA4AF', cta: '#06B6D4', accent: '#F59E0B', bg: '#FFF1F2', text: '#4C0519', border: '#FECDD3' },
  slate:    { primary: '#475569', secondary: '#94A3B8', cta: '#06B6D4', accent: '#8B5CF6', bg: '#F8FAFC', text: '#0F172A', border: '#CBD5E1' },
};

/**
 * 暗色预设：surface/surfaceElevated/surfaceOverlay 跟随每个 preset 的色温，
 * 不再统一用冷蓝紫 #1a1a2e，避免暖/绿/红主题暗色下出现不搭的冷色块。
 */
const darkPresets: Record<PresetName, Omit<ColorPreset, 'name' | 'label'>> = {
  amethyst: { primary: '#A78BFA', secondary: '#5B21B6', cta: '#22D3EE', accent: '#FCD34D', bg: '#1E1B4B', text: '#EDE9FE', border: '#5B21B6',
              surface: '#2A2756', surfaceElevated: '#33306B', surfaceOverlay: 'rgba(42, 39, 86, 0.85)' },
  amber:    { primary: '#FBBF24', secondary: '#92400E', cta: '#22D3EE', accent: '#F87171', bg: '#1C1917', text: '#FEF3C7', border: '#78350F',
              surface: '#292524', surfaceElevated: '#33302F', surfaceOverlay: 'rgba(41, 37, 36, 0.85)' },
  emerald:  { primary: '#34D399', secondary: '#065F46', cta: '#22D3EE', accent: '#FB923C', bg: '#022C22', text: '#D1FAE5', border: '#065F46',
              surface: '#064E3B', surfaceElevated: '#065F46', surfaceOverlay: 'rgba(6, 78, 59, 0.85)' },
  indigo:   { primary: '#818CF8', secondary: '#312E81', cta: '#22D3EE', accent: '#FB923C', bg: '#1E1B4B', text: '#E0E7FF', border: '#312E81',
              surface: '#2A2756', surfaceElevated: '#33306B', surfaceOverlay: 'rgba(42, 39, 86, 0.85)' },
  rose:     { primary: '#FB7185', secondary: '#9F1239', cta: '#22D3EE', accent: '#FCD34D', bg: '#4C0519', text: '#FFE4E6', border: '#9F1239',
              surface: '#881337', surfaceElevated: '#9F1239', surfaceOverlay: 'rgba(136, 19, 55, 0.85)' },
  slate:    { primary: '#94A3B8', secondary: '#1E293B', cta: '#22D3EE', accent: '#A78BFA', bg: '#0F172A', text: '#E2E8F0', border: '#334155',
              surface: '#1E293B', surfaceElevated: '#334155', surfaceOverlay: 'rgba(30, 41, 59, 0.85)' },
};

const presetLabels: Record<PresetName, string> = {
  amethyst: '紫晶',
  amber: '琥珀',
  emerald: '翡翠',
  indigo: '靛蓝',
  rose: '玫瑰',
  slate: '石墨',
};

export function getPreset(name: PresetName, isDark: boolean): ColorPreset {
  const colors = isDark ? darkPresets[name] : lightPresets[name];
  return { name, label: presetLabels[name], ...colors };
}

export const presetNames: PresetName[] = ['amethyst', 'amber', 'emerald', 'indigo', 'rose', 'slate'];
