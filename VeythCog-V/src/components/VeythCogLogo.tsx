import React, { useId } from 'react';

export interface VeythCogLogoProps {
  /** 主色 - 用于 V 和 C 字 */
  primaryColor: string;
  /** 对撞色 - 用于流彩丝带 */
  accentColor: string;
  /** 尺寸，默认 44 */
  size?: number;
}

/**
 * 渡思 VeythCog 页面内标识
 *
 * 视觉结构：
 * - V 字：主视觉，大而锐利，primaryColor
 * - C 字：较小，开放包容，primaryColor 低透明度
 * - 流彩丝带：渡越之流，填充形状柔和翻折交缠，颜色单向流动
 */
const VeythCogLogo: React.FC<VeythCogLogoProps> = ({
  primaryColor,
  accentColor,
  size = 44,
}) => {
  // 用 useId 避免多实例时 SVG id 冲突
  const uid = useId().replace(/:/g, '');
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* 流彩渐变 - 颜色沿飘带单向流动 */}
        <linearGradient
          id={`${uid}-ribbon-flow`}
          gradientUnits="userSpaceOnUse"
          x1="10"
          y1="24"
          x2="34"
          y2="24"
          spreadMethod="repeat"
        >
          <stop offset="0%" stopColor={accentColor} />
          <stop offset="50%" stopColor={primaryColor} />
          <stop offset="100%" stopColor={accentColor} />
          {/* 渐变整体向右滑动一个周期，产生单向流动 */}
          <animate attributeName="x1" from="10" to="34" dur="2s" repeatCount="indefinite" />
          <animate attributeName="x2" from="34" to="58" dur="2s" repeatCount="indefinite" />
        </linearGradient>

        {/* 发光滤镜 */}
        <filter id={`${uid}-glow`}>
          <feGaussianBlur stdDeviation="1" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* V 字 - 主视觉，大而锐利 */}
      <path
        d="M3 6 L16 42 L29 6"
        stroke={primaryColor}
        strokeWidth="4.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity={0.9}
      />

      {/* C 字 - 较小，开放包容 */}
      <path
        d="M43 16 C39 9 30 9 28 24 C26 39 35 41 43 35"
        stroke={primaryColor}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity={0.55}
      />

      {/* 流彩丝带 - 填充形状，柔和翻折交缠，渐变单向流动 + 发光 */}
      <path
        d="M2 26
           C5 23, 8 22, 11 19
           C13 17, 14 14, 15 13
           C16 12, 18 13, 20 16
           C22 19, 24 22, 27 21
           C30 20, 32 18, 35 21
           C38 22, 41 21, 44 22
           C45 23, 45 26, 44 28
           C42.5 27, 40 26, 38 25
           C35 25, 33 24, 30 25
           C27 26, 25 23, 23 24
           C21 25, 19 20, 17 19
           C15 18, 14 24, 11 25
           C8 26, 5 27, 2 28
           C1 28, 1 27, 2 26 Z"
        fill={`url(#${uid}-ribbon-flow)`}
        opacity={0.9}
        filter={`url(#${uid}-glow)`}
      />
    </svg>
  );
};

export default VeythCogLogo;