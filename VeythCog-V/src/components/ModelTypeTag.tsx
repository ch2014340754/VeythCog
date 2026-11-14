import audioIcon from '@iconify-icons/lucide/audio-lines';
import binaryIcon from '@iconify-icons/lucide/binary';
import boxIcon from '@iconify-icons/lucide/box';
import brainIcon from '@iconify-icons/lucide/brain';
import eyeIcon from '@iconify-icons/lucide/eye';
import imageIcon from '@iconify-icons/lucide/image';
import sparklesIcon from '@iconify-icons/lucide/sparkles';
import typeIcon from '@iconify-icons/lucide/type';
import videoIcon from '@iconify-icons/lucide/video';
import type { IconifyIcon } from '@iconify/react';
import { Icon } from '@iconify/react';
import React from 'react';

/**
 * 模态色调：只映射到主题语义色（primary / info / success / warning / error / neutral），
 * 具体色值由 CSS 变量提供，暗色与换肤时自动跟随，不再写死 AntD 调色板。
 */
export type ModelTone = 'primary' | 'info' | 'success' | 'warning' | 'error' | 'neutral';

/** 模型类型元数据：与后端 ModelType 编码一一对应 */
export interface ModelTypeMeta {
  label: string;
  tone: ModelTone;
  icon: IconifyIcon;
  /** 能否进入对话下拉 */
  chatCapable: boolean;
}

export const MODEL_TYPE_META: Record<string, ModelTypeMeta> = {
  text: { label: '文本', tone: 'primary', icon: typeIcon, chatCapable: true },
  reasoning: { label: '推理', tone: 'primary', icon: brainIcon, chatCapable: true },
  vision: { label: '多模态理解', tone: 'info', icon: eyeIcon, chatCapable: true },
  omni: { label: '全模态', tone: 'warning', icon: sparklesIcon, chatCapable: true },
  image: { label: '图像生成', tone: 'warning', icon: imageIcon, chatCapable: false },
  video: { label: '视频生成', tone: 'error', icon: videoIcon, chatCapable: false },
  audio: { label: '语音', tone: 'info', icon: audioIcon, chatCapable: false },
  embedding: { label: '向量', tone: 'success', icon: binaryIcon, chatCapable: false },
  other: { label: '其他', tone: 'neutral', icon: boxIcon, chatCapable: false },
};

/** 下拉/表单用的类型选项 */
export const MODEL_TYPE_OPTIONS = Object.entries(MODEL_TYPE_META).map(([value, meta]) => ({
  value,
  label: `${meta.label}（${value}）`,
}));

export function modelTypeMeta(type?: string | null): ModelTypeMeta {
  return MODEL_TYPE_META[type ?? 'text'] ?? MODEL_TYPE_META.other;
}

/** 多模态列表归一：优先 modalities，空则回退主类型，去重 */
export function resolveModelTypes(types?: (string | null)[] | null, fallback?: string | null): string[] {
  const source = types && types.length > 0 ? types : [fallback ?? 'text'];
  const seen = new Set<string>();
  source.forEach((type) => {
    if (type) {
      seen.add(type);
    }
  });
  return Array.from(seen);
}

/** 仅图标（对话页模型下拉、紧凑场景） */
export const ModelTypeIcon: React.FC<{ type?: string | null; size?: number }> = ({ type, size = 14 }) => {
  const meta = modelTypeMeta(type);
  return (
    <Icon
      icon={meta.icon}
      width={size}
      className={'vc-type-icon vc-type-icon--' + meta.tone}
    />
  );
};

/** 多个模态图标（对话下拉）：一个模型支持几种模态就展示几个 */
export const ModelModalityIcons: React.FC<{
  types?: (string | null)[] | null;
  fallback?: string | null;
  size?: number;
}> = ({ types, fallback, size = 13 }) => {
  const resolved = resolveModelTypes(types, fallback);
  return (
    <span className="vc-type-icons">
      {resolved.map((type) => (
        <ModelTypeIcon key={type} type={type} size={size} />
      ))}
    </span>
  );
};

/** 图标 + 文本标签（模型目录、模型配置行） */
export const ModelTypeTag: React.FC<{
  type?: string | null;
  compact?: boolean;
  showLabel?: boolean;
}> = ({ type, compact = false, showLabel = true }) => {
  const meta = modelTypeMeta(type);
  return (
    <span
      className={
        'vc-type-tag vc-type-tag--' + meta.tone + (compact ? ' vc-type-tag--compact' : '')
      }
    >
      <Icon icon={meta.icon} width={compact ? 12 : 13} />
      {showLabel ? meta.label : null}
    </span>
  );
};

/** 全部模态标签：同步写入多个类型后逐个展示，空值回退主类型 */
export const ModelModalityTags: React.FC<{
  types?: (string | null)[] | null;
  fallback?: string | null;
  compact?: boolean;
  showLabel?: boolean;
}> = ({ types, fallback, compact = false, showLabel = true }) => {
  const resolved = resolveModelTypes(types, fallback);
  return (
    <span className="vc-type-tags">
      {resolved.map((type) => (
        <ModelTypeTag key={type} type={type} compact={compact} showLabel={showLabel} />
      ))}
    </span>
  );
};
