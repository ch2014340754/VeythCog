import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import userIcon from '@iconify-icons/lucide/user';
import botIcon from '@iconify-icons/lucide/bot';
import copyIcon from '@iconify-icons/lucide/copy';
import checkIcon from '@iconify-icons/lucide/check';
import refreshIcon from '@iconify-icons/lucide/refresh-cw';
import ReactMarkdown from 'react-markdown';
import type { Message } from '@/types';
import { useTheme } from '@/contexts/ThemeContext';

interface MessageBubbleProps {
  message: Message;
  /** 是否在左侧显示头像（连续同角色消息只在首条显示） */
  showAvatar?: boolean;
  /** 重新生成回调（仅 assistant 消息显示） */
  onRegenerate?: (messageId: string) => void;
}

/** 格式化时间戳（绝对时间 HH:mm，今天不显示日期） */
function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  const timeStr = date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  if (isToday) return timeStr;
  const dateStr = date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
  return `${dateStr} ${timeStr}`;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, showAvatar = true, onRegenerate }) => {
  const { colors } = useTheme();
  const isUser = message.role === 'user';
  const [hovered, setHovered] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 剪贴板不可用时静默
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isUser ? 'row-reverse' : 'row',
        alignItems: 'flex-start',
        gap: 12,
        marginBottom: 20,
        animation: 'messageSlideIn 0.3s var(--ease-out)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* 头像：连续同角色消息不显示，保持紧凑 */}
      {showAvatar && (
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 'var(--radius-full)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            background: isUser ? colors.primary : colors.glassBg,
            border: isUser ? 'none' : '1px solid var(--glass-border)',
            backdropFilter: isUser ? 'none' : 'blur(8px)',
            color: isUser ? '#ffffff' : colors.primary,
          }}
        >
          <Icon icon={isUser ? userIcon : botIcon} width={18} />
        </div>
      )}

      {/* 消息内容 */}
      <div
        style={{
          // 限制最大宽度，长文本一行不超过 ~75ch，阅读更舒服
          maxWidth: 'min(680px, 72%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: isUser ? 'flex-end' : 'flex-start',
          // 无头像时，内容与有头像的消息对齐
          marginLeft: !showAvatar && !isUser ? 48 : 0,
          marginRight: !showAvatar && isUser ? 48 : 0,
        }}
      >
        <div
          style={{
            padding: '12px 16px',
            borderRadius: isUser
              ? '18px 18px 4px 18px'
              : '18px 18px 18px 4px',
            background: isUser ? colors.primary : colors.glassBg,
            color: isUser ? '#ffffff' : colors.text,
            border: isUser ? 'none' : `1px solid ${colors.glassBorder}`,
            backdropFilter: isUser ? 'none' : 'blur(var(--glass-blur))',
            fontSize: 14,
            lineHeight: 1.7,
            wordBreak: 'break-word',
            boxShadow: isUser
              ? `0 2px 8px ${colors.primary30}`
              : 'var(--shadow-sm)',
          }}
        >
          {isUser ? (
            <div style={{ whiteSpace: 'pre-wrap' }}>{message.content}</div>
          ) : (
            <div className="md-body">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          )}
        </div>

        {/* 时间戳 + hover 操作 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 4,
            padding: '0 4px',
          }}
        >
          <span style={{ fontSize: 11, color: colors.textTertiary }}>
            {formatTime(message.timestamp)}
          </span>
          <button
            onClick={handleCopy}
            title="复制"
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: colors.textTertiary,
              display: 'flex',
              alignItems: 'center',
              padding: 2,
              opacity: hovered ? 1 : 0,
              transition: 'opacity 0.15s',
            }}
          >
            <Icon icon={copied ? checkIcon : copyIcon} width={12} style={{ color: copied ? colors.success : undefined }} />
          </button>
          {!isUser && onRegenerate && (
            <button
              onClick={() => onRegenerate(message.id)}
              title="重新生成"
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: colors.textTertiary,
                display: 'flex',
                alignItems: 'center',
                padding: 2,
                opacity: hovered ? 1 : 0,
                transition: 'opacity 0.15s',
              }}
            >
              <Icon icon={refreshIcon} width={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
