import { ColorPreset, PresetName } from '@/types';

/**
 * 亮色预设：surface 统一白色系，不在这里指定
 *
 * 后六套（潮汐/新芽/钴蓝/青柠/落日/薄雾）按用户提供的六组色板取色：
 * 背景/文字沿用截图；primary 与 accent 在保持截图色相的前提下压深到对背景可读；
 * accent 与 primary 至少保持 25° 色相差 + 明度差，保证 Logo 飘带两端可辨。
 */
const lightPresets: Record<PresetName, Omit<ColorPreset, 'name' | 'label' | 'surface' | 'surfaceElevated' | 'surfaceOverlay'>> = {
  amethyst: { primary: '#7C3AED', secondary: '#C4B5FD', cta: '#06B6D4', accent: '#FBBF24', bg: '#FAF5FF', text: '#1E1B4B', border: '#DDD6FE' },
  emerald:  { primary: '#059669', secondary: '#6EE7B7', cta: '#06B6D4', accent: '#F97316', bg: '#ECFDF5', text: '#022C22', border: '#A7F3D0' },
  indigo:   { primary: '#4F46E5', secondary: '#818CF8', cta: '#06B6D4', accent: '#F97316', bg: '#EEF2FF', text: '#1E1B4B', border: '#C7D2FE' },
  // rose 亮模式 accent 从白色改为琥珀，避免在浅粉底上不可见
  rose:     { primary: '#E11D48', secondary: '#FDA4AF', cta: '#06B6D4', accent: '#F59E0B', bg: '#FFF1F2', text: '#4C0519', border: '#FECDD3' },
  slate:    { primary: '#475569', secondary: '#94A3B8', cta: '#06B6D4', accent: '#8B5CF6', bg: '#F8FAFC', text: '#0F172A', border: '#CBD5E1' },
  tide:     { primary: '#0F7370', secondary: '#B9F3D4', cta: '#117741', accent: '#2188E2', bg: '#D2EEEE', text: '#2A3C3C', border: '#BEE5E3' },
  sprout:   { primary: '#0B772F', secondary: '#C1F6B7', cta: '#1E770D', accent: '#0E967F', bg: '#D0F0DB', text: '#2A3C30', border: '#BCE6CA' },
  cobalt:   { primary: '#273BF6', secondary: '#B6DDF7', cta: '#085E96', accent: '#924EF8', bg: '#CED1F3', text: '#2A2C3C', border: '#B9BEE9' },
  lime:     { primary: '#4D7C0F', secondary: '#F7F2B6', cta: '#7E740B', accent: '#1AA90D', bg: '#F8FCF3', text: '#353C2A', border: '#D5E7BB' },
  sunset:   { primary: '#B45309', secondary: '#F7BDB6', cta: '#DC240C', accent: '#889907', bg: '#FCF8F3', text: '#3C352A', border: '#E9D7BA' },
  mist:     { primary: '#0369A1', secondary: '#BFEDE3', cta: '#1F7E68', accent: '#738CDF', bg: '#F5F8FA', text: '#2A373C', border: '#C2D9E1' },
};

/**
 * 暗色预设：surface/surfaceElevated/surfaceOverlay 跟随每个 preset 的色温，
 * 不再统一用冷蓝紫 #1a1a2e，避免暖/绿/红主题暗色下出现不搭的冷色块。
 */
const darkPresets: Record<PresetName, Omit<ColorPreset, 'name' | 'label'>> = {
  amethyst: { primary: '#A78BFA', secondary: '#5B21B6', cta: '#22D3EE', accent: '#FCD34D', bg: '#1E1B4B', text: '#EDE9FE', border: '#5B21B6',
              surface: '#2A2756', surfaceElevated: '#33306B', surfaceOverlay: 'rgba(42, 39, 86, 0.85)' },
  emerald:  { primary: '#34D399', secondary: '#065F46', cta: '#22D3EE', accent: '#FB923C', bg: '#022C22', text: '#D1FAE5', border: '#065F46',
              surface: '#064E3B', surfaceElevated: '#065F46', surfaceOverlay: 'rgba(6, 78, 59, 0.85)' },
  indigo:   { primary: '#818CF8', secondary: '#312E81', cta: '#22D3EE', accent: '#FB923C', bg: '#1E1B4B', text: '#E0E7FF', border: '#312E81',
              surface: '#2A2756', surfaceElevated: '#33306B', surfaceOverlay: 'rgba(42, 39, 86, 0.85)' },
  rose:     { primary: '#FB7185', secondary: '#9F1239', cta: '#22D3EE', accent: '#FCD34D', bg: '#4C0519', text: '#FFE4E6', border: '#9F1239',
              surface: '#881337', surfaceElevated: '#9F1239', surfaceOverlay: 'rgba(136, 19, 55, 0.85)' },
  slate:    { primary: '#94A3B8', secondary: '#1E293B', cta: '#22D3EE', accent: '#A78BFA', bg: '#0F172A', text: '#E2E8F0', border: '#334155',
              surface: '#1E293B', surfaceElevated: '#334155', surfaceOverlay: 'rgba(30, 41, 59, 0.85)' },
  tide:     { primary: '#1DC8C1', secondary: '#1CA65C', cta: '#1CC068', accent: '#69AEE9', bg: '#0D2120', text: '#E3F7F6', border: '#2F7472',
              surface: '#173534', surfaceElevated: '#214544', surfaceOverlay: 'rgba(23, 53, 52, 0.85)' },
  sprout:   { primary: '#16CF53', secondary: '#2FAB17', cta: '#31C215', accent: '#14BDA0', bg: '#0C2213', text: '#E3F7EA', border: '#2C7745',
              surface: '#163621', surfaceElevated: '#1F472C', surfaceOverlay: 'rgba(22, 54, 33, 0.85)' },
  cobalt:   { primary: '#6D8DFF', secondary: '#1371AE', cta: '#29A4F4', accent: '#B486F9', bg: '#0B0D23', text: '#E3E5F7', border: '#28307C',
              surface: '#161A40', surfaceElevated: '#1F2450', surfaceOverlay: 'rgba(22, 26, 64, 0.85)' },
  lime:     { primary: '#7CC912', secondary: '#AEA213', cta: '#B9AC10', accent: '#20C411', bg: '#19220C', text: '#EFF7E3', border: '#58792A',
              surface: '#293715', surfaceElevated: '#36471F', surfaceOverlay: 'rgba(41, 55, 21, 0.85)' },
  sunset:   { primary: '#F2A018', secondary: '#AE2513', cta: '#F78576', accent: '#9DAF0A', bg: '#231A0B', text: '#F7F0E3', border: '#7B5C28',
              surface: '#382B14', surfaceElevated: '#49381D', surfaceOverlay: 'rgba(56, 43, 20, 0.85)' },
  mist:     { primary: '#64BBD9', secondary: '#2A987E', cta: '#2DB897', accent: '#8DA2E3', bg: '#0F1B1F', text: '#E3F2F7', border: '#365F6D',
              surface: '#1A2C32', surfaceElevated: '#253A41', surfaceOverlay: 'rgba(26, 44, 50, 0.85)' },
};

const presetLabels: Record<PresetName, string> = {
  amethyst: '紫晶',
  emerald: '翡翠',
  indigo: '靛蓝',
  rose: '玫瑰',
  slate: '石墨',
  tide: '潮汐',
  sprout: '新芽',
  cobalt: '钴蓝',
  lime: '青柠',
  sunset: '落日',
  mist: '薄雾',
};

export function getPreset(name: PresetName, isDark: boolean): ColorPreset {
  const colors = isDark ? darkPresets[name] : lightPresets[name];
  return { name, label: presetLabels[name], ...colors };
}

export const presetNames: PresetName[] = ['amethyst', 'emerald', 'indigo', 'rose', 'slate', 'tide', 'sprout', 'cobalt', 'lime', 'sunset', 'mist'];
