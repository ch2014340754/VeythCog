import React from 'react';
import { Icon } from '@iconify/react';
import type { IconifyIcon } from '@iconify/react';
import { Tag } from 'antd';
import typeIcon from '@iconify-icons/lucide/type';
import brainIcon from '@iconify-icons/lucide/brain';
import eyeIcon from '@iconify-icons/lucide/eye';
import sparklesIcon from '@iconify-icons/lucide/sparkles';
import imageIcon from '@iconify-icons/lucide/image';
import videoIcon from '@iconify-icons/lucide/video';
import audioIcon from '@iconify-icons/lucide/audio-lines';
import binaryIcon from '@iconify-icons/lucide/binary';
import boxIcon from '@iconify-icons/lucide/box';

/** 模型类型元数据：与后端 ModelType 编码一一对应 */
export interface ModelTypeMeta {
  label: string;
  color: string;
  background: string;
  icon: IconifyIcon;
  /** 能否进入对话下拉 */
  chatCapable: boolean;
}

export const MODEL_TYPE_META: Record<string, ModelTypeMeta> = {
  text: { label: '文本', color: '#1677ff', background: 'rgba(22,119,255,0.12)', icon: typeIcon, chatCapable: true },
  reasoning: { label: '推理', color: '#722ed1', background: 'rgba(114,46,209,0.12)', icon: brainIcon, chatCapable: true },
  vision: { label: '多模态理解', color: '#13c2c2', background: 'rgba(19,194,194,0.14)', icon: eyeIcon, chatCapable: true },
  omni: { label: '全模态', color: '#d48806', background: 'rgba(212,136,6,0.14)', icon: sparklesIcon, chatCapable: true },
  image: { label: '图像生成', color: '#fa8c16', background: 'rgba(250,140,22,0.12)', icon: imageIcon, chatCapable: false },
  video: { label: '视频生成', color: '#eb2f96', background: 'rgba(235,47,150,0.12)', icon: videoIcon, chatCapable: false },
  audio: { label: '语音', color: '#08979c', background: 'rgba(8,151,156,0.12)', icon: audioIcon, chatCapable: false },
  embedding: { label: '向量', color: '#389e0d', background: 'rgba(56,158,13,0.12)', icon: binaryIcon, chatCapable: false },
  other: { label: '其他', color: '#8c8c8c', background: 'rgba(140,140,140,0.12)', icon: boxIcon, chatCapable: false },
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
      style={{ color: meta.color, flexShrink: 0, verticalAlign: '-2px' }}
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
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
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
    <Tag
      style={{
        marginInlineEnd: 0,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        paddingInline: compact ? 6 : 8,
        border: 'none',
        borderRadius: 6,
        color: meta.color,
        background: meta.background,
        fontSize: compact ? 11 : 12,
        lineHeight: '20px',
      }}
    >
      <Icon icon={meta.icon} width={compact ? 12 : 13} />
      {showLabel ? meta.label : null}
    </Tag>
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
    <span style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
      {resolved.map((type) => (
        <ModelTypeTag key={type} type={type} compact={compact} showLabel={showLabel} />
      ))}
    </span>
  );
};
