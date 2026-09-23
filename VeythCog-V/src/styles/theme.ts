import { theme } from 'antd';
import type { ThemeConfig } from 'antd';
import { ColorPreset } from '@/types';

const { defaultAlgorithm, darkAlgorithm } = theme;

/**
 * 根据配色预设生成 Ant Design 主题配置
 * @param preset 配色预设
 * @param isDark 是否为暗色模式
 */
export function generateAntDTheme(preset: ColorPreset, isDark: boolean): ThemeConfig {
  // 暗色表面色跟随 preset，亮色统一白色
  const surface = isDark ? preset.surface ?? '#1a1a2e' : '#ffffff';
  const surfaceElevated = isDark ? preset.surfaceElevated ?? '#22223a' : '#ffffff';
  const layoutBg = isDark ? preset.bg : preset.bg;

  return {
    algorithm: isDark ? darkAlgorithm : defaultAlgorithm,
    token: {
      colorPrimary: preset.primary,
      colorBgContainer: surface,
      colorBgLayout: layoutBg,
      colorText: preset.text,
      colorBorder: preset.border,
      colorInfo: preset.cta,
      borderRadius: 12,
      fontFamily: "'Space Grotesk', 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      colorLink: preset.cta,
      colorLinkHover: preset.cta,
      fontSize: 14,
      lineHeight: 1.6,
      controlHeight: 40,
    },
    components: {
      Layout: {
        colorBgContainer: surface,
        colorBgLayout: layoutBg,
        siderBg: isDark ? surface : 'transparent',
        headerBg: 'transparent',
        bodyBg: layoutBg,
      },
      Menu: {
        colorItemBg: 'transparent',
        colorItemBgSelected: isDark ? `${preset.primary}20` : `${preset.primary}15`,
        colorItemBgHover: isDark ? `${preset.primary}15` : `${preset.primary}10`,
        colorItemText: preset.text,
        colorItemTextSelected: preset.primary,
        colorItemTextHover: preset.primary,
        itemBorderRadius: 8,
        itemMarginInline: 4,
        itemHeight: 44,
      },
      Button: {
        colorPrimary: preset.primary,
        colorPrimaryHover: preset.primary,
        colorPrimaryActive: preset.primary,
        primaryShadow: 'none',
        borderRadius: 10,
        controlHeight: 40,
        fontWeight: 600,
      },
      Input: {
        colorBgContainer: surfaceElevated,
        colorBorder: preset.border,
        colorBgContainerDisabled: isDark ? `${preset.secondary}55` : '#f5f5f5',
        borderRadius: 10,
        controlHeight: 40,
      },
      Card: {
        colorBgContainer: surface,
        colorBorderSecondary: preset.border,
        borderRadiusLG: 16,
        boxShadowTertiary: isDark
          ? '0 1px 2px 0 rgba(0, 0, 0, 0.3)'
          : '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
      },
      Select: {
        colorBgContainer: surfaceElevated,
        colorBorder: preset.border,
        borderRadius: 10,
        optionSelectedBg: isDark ? `${preset.primary}25` : `${preset.primary}15`,
      },
      Table: {
        colorBgContainer: surface,
        headerBg: isDark ? surfaceElevated : `${preset.primary}08`,
        rowHoverBg: isDark ? `${preset.primary}10` : `${preset.primary}06`,
      },
      Modal: {
        contentBg: surface,
        headerBg: surface,
      },
      Tooltip: {
        colorBgSpotlight: isDark ? surfaceElevated : '#1f2937',
      },
      Message: {
        contentBg: surface,
      },
      Tabs: {
        inkBarColor: preset.primary,
        itemSelectedColor: preset.primary,
        itemHoverColor: preset.primary,
      },
    },
  };
}