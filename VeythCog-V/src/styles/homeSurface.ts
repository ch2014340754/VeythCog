/* ========================================
   导航页浮层皮肤：与全局主题共用同一套毛玻璃参数
   - 无壁纸时直接用 ThemeContext 的 glassBg / glassBorder
   - 有壁纸时用白色玻璃变体，厚度仍跟随全局「面板玻璃朦胧感」
   ======================================== */

/** 与 MainLayout 内容面板一致的模糊强度（跟全局朦胧度联动） */
export function glassBlur(glassOpacity: number): string {
  return `blur(${Math.round(2 + (glassOpacity / 100) * 28)}px) saturate(160%)`;
}

/** 壁纸模式下的白色玻璃：透明度随全局朦胧度增长 */
export function whiteGlass(glassOpacity: number, min = 0.12, max = 0.4): string {
  const alpha = min + (glassOpacity / 100) * (max - min);
  return `rgba(255, 255, 255, ${alpha.toFixed(2)})`;
}
