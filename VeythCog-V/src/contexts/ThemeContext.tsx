import React, { createContext, useContext, useState, useLayoutEffect, useCallback, useMemo } from 'react';
import type { PresetName, AppearanceMode } from '../types';
import { getPreset, presetNames } from '../styles/presets';
import { overlayColor, resolveBackground } from '../styles/backgrounds';
import { useSettingsStore } from '../stores/settingsStore';
import { useWallpaperStore } from '../stores/wallpaperStore';

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

// 白名单直接取 presetNames：增删预设只需改 presets.ts，这里不用跟着维护
function getStoredPreset(): PresetName {
  try {
    const stored = localStorage.getItem(PRESET_KEY);
    if (stored && (presetNames as string[]).includes(stored)) {
      return stored as PresetName;
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
      textSecondary: '#C4C0DA',
      // 暗色下辅助文字提亮，避免在深底上对比不足
      textTertiary: '#A8A4C2',
      textTertiary15: 'rgba(168, 164, 194, 0.15)',
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
    textSecondary: '#4B5563',
    textTertiary: '#66707E',
    textTertiary15: 'rgba(102, 112, 126, 0.15)',
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
function applyCSSVariables(presetName: PresetName, isDark: boolean, glassEnabled: boolean, glassOpacity: number): void {
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
    // 毛玻璃模式：CSS 变量必须与 useTheme().colors 同源（半透明），
    // 否则用 CSS 变量写样式的区域（输入件 / 面板）会变成实心块，玻璃层断裂。
    const surfaceVar = glassEnabled ? hexToRgba(surface, 0.55) : surface;
    const surfaceElevatedVar = glassEnabled ? hexToRgba(surfaceElevated, 0.65) : surfaceElevated;
    root.style.setProperty('--color-surface', surfaceVar);
    root.style.setProperty('--color-surface-elevated', surfaceElevatedVar);
    root.style.setProperty('--color-surface-overlay', surfaceOverlay);
    // 暗色下正文与次级文字在毛玻璃 / 壁纸上会被再压一层对比度，
    // 次级色往 text 提亮一档（原 #9CA3AF / #8A8FA3 在深紫面板上发灰）。
    root.style.setProperty('--color-text-secondary', '#C4C0DA');
    root.style.setProperty('--color-text-tertiary', '#A8A4C2');
    root.style.setProperty('--color-text-tertiary-15', 'rgba(168, 164, 194, 0.15)');
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
    const lightSurface = glassEnabled ? 'rgba(255, 255, 255, 0.55)' : '#ffffff';
    const lightSurfaceElevated = glassEnabled ? 'rgba(255, 255, 255, 0.65)' : '#ffffff';
    root.style.setProperty('--color-surface', lightSurface);
    root.style.setProperty('--color-surface-elevated', lightSurfaceElevated);
    root.style.setProperty('--color-surface-overlay', 'rgba(255, 255, 255, 0.85)');
    root.style.setProperty('--color-text-secondary', '#4B5563');
    root.style.setProperty('--color-text-tertiary', '#66707E');
    root.style.setProperty('--color-text-tertiary-15', 'rgba(102, 112, 126, 0.15)');
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
  const overlayOpacity = useSettingsStore((s) => s.overlayOpacity);
  const activeWallpaper = useWallpaperStore((s) => s.active);

  const isDark = useMemo(() => computeIsDark(appearanceMode), [appearanceMode]);

  // 计算当前主题颜色集（供组件 inline style 直接使用）
  const colors = useMemo(() => computeThemeColors(presetName, isDark, glassEnabled, glassOpacity), [presetName, isDark, glassEnabled, glassOpacity]);

  // 主题变化时同步 CSS 变量 + dark 类（使用 useLayoutEffect 避免闪烁）
  useLayoutEffect(() => {
    applyCSSVariables(presetName, isDark, glassEnabled, glassOpacity);
    applyDarkClass(isDark);
  }, [presetName, isDark, glassEnabled, glassOpacity]);

  // 全局毛玻璃开关：给 body 加 glass-on class，global.css 据此覆盖 AntD 组件
  useLayoutEffect(() => {
    document.body.classList.toggle('glass-on', glassEnabled);
  }, [glassEnabled]);

  // 背景：全站唯一壁纸（用户绑定）优先，无壁纸时回落纯色/渐变兜底
  useLayoutEffect(() => {
    const body = document.body;

    // 动态壁纸由 WallpaperBackdrop 全屏渲染，body 只保留纯色，避免两层叠加
    if (activeWallpaper?.kind === 'video') {
      body.classList.remove('has-bg');
      // has-bg 专门指"图片壁纸铺在 body 上"；has-wall 指"屏幕上确实有壁纸"，
      // 给首页压在照片上的图标标题用（亮色下靠它加浅色衬光，否则小字发虚）。
      body.classList.add('has-wall');
      body.style.backgroundImage = '';
      body.style.setProperty('--bg-overlay', 'transparent');
      return;
    }

    if (activeWallpaper?.kind === 'image') {
      body.classList.add('has-bg');
      body.classList.add('has-wall');
      body.style.backgroundImage = `url("${activeWallpaper.url}")`;
      body.style.backgroundSize = 'cover';
      body.style.backgroundPosition = 'center';
      body.style.backgroundRepeat = 'no-repeat';
      body.style.backgroundAttachment = 'scroll';
      body.style.setProperty('--bg-overlay', overlayColor(overlayOpacity, isDark));
      return;
    }

    const { active, css } = resolveBackground(background, isDark);
    if (active) {
      body.classList.add('has-bg');
      body.classList.add('has-wall');
      body.style.backgroundImage = css;
      body.style.backgroundSize = 'cover';
      body.style.backgroundPosition = 'center';
      body.style.backgroundRepeat = 'no-repeat';
      body.style.backgroundAttachment = 'scroll';
      body.style.setProperty('--bg-overlay', 'transparent');
    } else {
      body.classList.remove('has-bg');
      body.classList.remove('has-wall');
      body.style.backgroundImage = '';
      body.style.setProperty('--bg-overlay', 'transparent');
    }
  }, [activeWallpaper, background, overlayOpacity, isDark]);

  // 监听系统主题变化（仅在 system 模式下生效）
  useLayoutEffect(() => {
    if (appearanceMode !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      applyDarkClass(e.matches);
      applyCSSVariables(presetName, e.matches, glassEnabled, glassOpacity);
    };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [appearanceMode, presetName, glassEnabled, glassOpacity]);

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