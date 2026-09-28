import React, { createContext, useContext, useState, useLayoutEffect, useCallback, useMemo } from 'react';
import type { PresetName, AppearanceMode } from '../types';
import { getPreset } from '../styles/presets';
import { resolveBackground } from '../styles/backgrounds';
import { useSettingsStore } from '../stores/settingsStore';

/** 主题颜色集合 - 供组件 inline style 直接使用，避免 CSS 变量解析延迟 */
export interface ThemeColors {
  primary: string;
  primary10: string;
  primary15: string;
  primary30: string;
  primary40: string;
  secondary: string;
  cta: string;
  accent: string;
  bg: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  textTertiary15: string;
  textInverse: string;
  border: string;
  divider: string;
  surface: string;
  surfaceElevated: string;
  surfaceOverlay: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  glassBg: string;
  glassBorder: string;
}

interface ThemeState {
  presetName: PresetName;
  appearanceMode: AppearanceMode;
  isDark: boolean;
  colors: ThemeColors;
  setPreset: (name: PresetName) => void;
  setAppearance: (mode: AppearanceMode) => void;
}

const ThemeContext = createContext<ThemeState | null>(null);

const PRESET_KEY = 'theme-preset';
const APPEARANCE_KEY = 'theme-appearance';

function getStoredPreset(): PresetName {
  try {
    const stored = localStorage.getItem(PRESET_KEY);
    if (stored === 'amethyst' || stored === 'amber' || stored === 'emerald' || stored === 'indigo' || stored === 'rose' || stored === 'slate') {
      return stored;
    }
  } catch {
    // localStorage 不可用时忽略
  }
  return 'amethyst';
}

function getStoredAppearance(): AppearanceMode {
  try {
    const stored = localStorage.getItem(APPEARANCE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored;
    }
  } catch {
    // localStorage 不可用时忽略
  }
  return 'light';
}

function computeIsDark(mode: AppearanceMode): boolean {
  if (mode === 'dark') return true;
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return false;
}

function applyDarkClass(isDark: boolean): void {
  if (isDark) {
    document.body.classList.add('dark');
  } else {
    document.body.classList.remove('dark');
  }
}

/** 将 hex 颜色转为 rgba 字符串 */
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** 根据预设和暗色模式计算完整颜色集（供组件 inline style 直接使用） */
function computeThemeColors(presetName: PresetName, isDark: boolean, glassEnabled: boolean, glassOpacity: number): ThemeColors {
  const preset = getPreset(presetName, isDark);
  if (isDark) {
    const surface = preset.surface ?? '#1a1a2e';
    const surfaceElevated = preset.surfaceElevated ?? '#22223a';
    const surfaceOverlay = preset.surfaceOverlay ?? 'rgba(26, 26, 46, 0.85)';
    // 毛玻璃模式：surface 半透明，让 backdrop-filter 生效
    const glassSurface = glassEnabled ? hexToRgba(surface, 0.55) : surface;
    const glassSurfaceElevated = glassEnabled ? hexToRgba(surfaceElevated, 0.65) : surfaceElevated;
    return {
      primary: preset.primary,
      primary10: hexToRgba(preset.primary, 0.1),
      primary15: hexToRgba(preset.primary, 0.15),
      primary30: hexToRgba(preset.primary, 0.3),
      primary40: hexToRgba(preset.primary, 0.4),
      secondary: preset.secondary,
      cta: preset.cta,
      accent: preset.accent,
      bg: preset.bg,
      text: preset.text,
      textSecondary: '#9CA3AF',
      // 暗色下辅助文字提亮，避免在深底上对比不足
      textTertiary: '#8A8FA3',
      textTertiary15: 'rgba(138, 143, 163, 0.15)',
      textInverse: '#1E1B4B',
      border: preset.border,
      divider: hexToRgba(preset.border, 0.4),
      surface: glassSurface,
      surfaceElevated: glassSurfaceElevated,
      surfaceOverlay,
      success: '#34D399',
      warning: '#FBBF24',
      error: '#F87171',
      info: '#22D3EE',
      glassBg: hexToRgba(surface, 0.1 + (glassOpacity / 100) * 0.65),
      glassBorder: 'rgba(255, 255, 255, 0.1)',
    };
  }
  // 亮色
  const solidSurface = '#ffffff';
  const lightSurface = glassEnabled ? 'rgba(255, 255, 255, 0.55)' : solidSurface;
  const lightSurfaceElevated = glassEnabled ? 'rgba(255, 255, 255, 0.65)' : solidSurface;
  return {
    primary: preset.primary,
    primary10: hexToRgba(preset.primary, 0.1),
    primary15: hexToRgba(preset.primary, 0.15),
    primary30: hexToRgba(preset.primary, 0.3),
    primary40: hexToRgba(preset.primary, 0.4),
    secondary: preset.secondary,
    cta: preset.cta,
    accent: preset.accent,
    bg: preset.bg,
    text: preset.text,
    textSecondary: '#6B7280',
    textTertiary: '#9CA3AF',
    textTertiary15: 'rgba(156, 163, 175, 0.15)',
    textInverse: '#ffffff',
    border: preset.border,
    divider: '#E5E7EB',
    surface: lightSurface,
    surfaceElevated: lightSurfaceElevated,
    surfaceOverlay: 'rgba(255, 255, 255, 0.85)',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#06B6D4',
    glassBg: hexToRgba('#ffffff', 0.1 + (glassOpacity / 100) * 0.65),
    glassBorder: 'rgba(255, 255, 255, 0.3)',
  };
}

/** 将预设颜色和暗色模式变量注入到 CSS 变量 */
function applyCSSVariables(presetName: PresetName, isDark: boolean, glassOpacity: number): void {
  const preset = getPreset(presetName, isDark);
  const root = document.documentElement;

  // 预设颜色
  root.style.setProperty('--color-primary', preset.primary);
  root.style.setProperty('--color-secondary', preset.secondary);
  root.style.setProperty('--color-cta', preset.cta);
  root.style.setProperty('--color-accent', preset.accent);
  root.style.setProperty('--color-bg', preset.bg);
  root.style.setProperty('--color-text', preset.text);
  root.style.setProperty('--color-border', preset.border);

  // 预设颜色的 alpha 变体（用于背景高亮、阴影等场景）
  root.style.setProperty('--color-primary-10', hexToRgba(preset.primary, 0.1));
  root.style.setProperty('--color-primary-15', hexToRgba(preset.primary, 0.15));
  root.style.setProperty('--color-primary-30', hexToRgba(preset.primary, 0.3));
  root.style.setProperty('--color-primary-40', hexToRgba(preset.primary, 0.4));

  if (isDark) {
    const surface = preset.surface ?? '#1a1a2e';
    const surfaceElevated = preset.surfaceElevated ?? '#22223a';
    const surfaceOverlay = preset.surfaceOverlay ?? 'rgba(26, 26, 46, 0.85)';
    root.style.setProperty('--color-surface', surface);
    root.style.setProperty('--color-surface-elevated', surfaceElevated);
    root.style.setProperty('--color-surface-overlay', surfaceOverlay);
    root.style.setProperty('--color-text-secondary', '#9CA3AF');
    root.style.setProperty('--color-text-tertiary', '#8A8FA3');
    root.style.setProperty('--color-text-tertiary-15', 'rgba(138, 143, 163, 0.15)');
    root.style.setProperty('--color-text-inverse', '#1E1B4B');
    root.style.setProperty('--color-divider', hexToRgba(preset.border, 0.4));
    root.style.setProperty('--color-success', '#34D399');
    root.style.setProperty('--color-warning', '#FBBF24');
    root.style.setProperty('--color-error', '#F87171');
    root.style.setProperty('--color-info', '#22D3EE');
    root.style.setProperty('--noise-opacity', '0.04');
    root.style.setProperty('--glass-bg', hexToRgba(surface, 0.1 + (glassOpacity / 100) * 0.65));
    root.style.setProperty('--glass-border', 'rgba(255, 255, 255, 0.1)');
    root.style.setProperty('--shadow-sm', '0 1px 2px 0 rgba(0, 0, 0, 0.3)');
    root.style.setProperty('--shadow-md', '0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -2px rgba(0, 0, 0, 0.3)');
    root.style.setProperty('--shadow-lg', '0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -4px rgba(0, 0, 0, 0.3)');
    root.style.setProperty('--shadow-xl', '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.4)');
  } else {
    root.style.setProperty('--color-surface', '#ffffff');
    root.style.setProperty('--color-surface-elevated', '#ffffff');
    root.style.setProperty('--color-surface-overlay', 'rgba(255, 255, 255, 0.85)');
    root.style.setProperty('--color-text-secondary', '#6B7280');
    root.style.setProperty('--color-text-tertiary', '#9CA3AF');
    root.style.setProperty('--color-text-tertiary-15', 'rgba(156, 163, 175, 0.15)');
    root.style.setProperty('--color-text-inverse', '#ffffff');
    root.style.setProperty('--color-divider', '#E5E7EB');
    root.style.setProperty('--color-success', '#10B981');
    root.style.setProperty('--color-warning', '#F59E0B');
    root.style.setProperty('--color-error', '#EF4444');
    root.style.setProperty('--color-info', '#06B6D4');
    root.style.setProperty('--noise-opacity', '0.03');
    root.style.setProperty('--glass-bg', hexToRgba('#ffffff', 0.1 + (glassOpacity / 100) * 0.65));
    root.style.setProperty('--glass-border', 'rgba(255, 255, 255, 0.3)');
    root.style.setProperty('--shadow-sm', '0 1px 2px 0 rgba(0, 0, 0, 0.05)');
    root.style.setProperty('--shadow-md', '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)');
    root.style.setProperty('--shadow-lg', '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)');
    root.style.setProperty('--shadow-xl', '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)');
  }
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [presetName, setPresetName] = useState<PresetName>(getStoredPreset);
  const [appearanceMode, setAppearanceMode] = useState<AppearanceMode>(getStoredAppearance);
  const glassEnabled = useSettingsStore((s) => s.glassEnabled);
  const glassOpacity = useSettingsStore((s) => s.glassOpacity);
  const background = useSettingsStore((s) => s.background);
  const overlayStrength = useSettingsStore((s) => s.overlayStrength);

  const isDark = useMemo(() => computeIsDark(appearanceMode), [appearanceMode]);

  // 计算当前主题颜色集（供组件 inline style 直接使用）
  const colors = useMemo(() => computeThemeColors(presetName, isDark, glassEnabled, glassOpacity), [presetName, isDark, glassEnabled, glassOpacity]);

  // 主题变化时同步 CSS 变量 + dark 类（使用 useLayoutEffect 避免闪烁）
  useLayoutEffect(() => {
    applyCSSVariables(presetName, isDark, glassOpacity);
    applyDarkClass(isDark);
  }, [presetName, isDark, glassOpacity]);

  // 全局毛玻璃开关：给 body 加 glass-on class，global.css 据此覆盖 AntD 组件
  useLayoutEffect(() => {
    document.body.classList.toggle('glass-on', glassEnabled);
  }, [glassEnabled]);

  // 背景：内置渐变 / 自定义图片（随亮暗与遮罩强度联动）
  useLayoutEffect(() => {
    const { active, css, overlay } = resolveBackground(background, isDark, overlayStrength);
    const body = document.body;
    if (active) {
      body.classList.add('has-bg');
      body.style.backgroundImage = css;
      body.style.backgroundSize = 'cover';
      body.style.backgroundPosition = 'center';
      body.style.backgroundRepeat = 'no-repeat';
      body.style.backgroundAttachment = 'scroll';
      body.style.setProperty('--bg-overlay', overlay);
    } else {
      body.classList.remove('has-bg');
      body.style.backgroundImage = '';
      body.style.setProperty('--bg-overlay', 'transparent');
    }
  }, [background, overlayStrength, isDark]);

  // 监听系统主题变化（仅在 system 模式下生效）
  useLayoutEffect(() => {
    if (appearanceMode !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      applyDarkClass(e.matches);
      applyCSSVariables(presetName, e.matches, glassOpacity);
    };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [appearanceMode, presetName, glassOpacity]);

  const setPreset = useCallback((name: PresetName) => {
    setPresetName(name);
    try {
      localStorage.setItem(PRESET_KEY, name);
    } catch {
      // 忽略
    }
  }, []);

  const setAppearance = useCallback((mode: AppearanceMode) => {
    setAppearanceMode(mode);
    try {
      localStorage.setItem(APPEARANCE_KEY, mode);
    } catch {
      // 忽略
    }
  }, []);

  const value = useMemo<ThemeState>(() => ({
    presetName,
    appearanceMode,
    isDark,
    colors,
    setPreset,
    setAppearance,
  }), [presetName, appearanceMode, isDark, colors, setPreset, setAppearance]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme(): ThemeState {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}