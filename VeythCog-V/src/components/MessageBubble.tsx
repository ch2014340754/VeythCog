import botIcon from '@iconify-icons/lucide/bot';
import checkIcon from '@iconify-icons/lucide/check';
import copyIcon from '@iconify-icons/lucide/copy';
import refreshIcon from '@iconify-icons/lucide/refresh-cw';
import userIcon from '@iconify-icons/lucide/user';
import { Icon } from '@iconify/react';
import type { Message } from '@/types';
import { useTypewriter } from '@/hooks/useTypewriter';
import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';

interface MessageBubbleProps {
  message: Message;
  /** 是否在左侧显示头像（连续同角色消息只在首条显示） */
  showAvatar?: boolean;
  /** 重新生成回调（仅 assistant 消息显示） */
  onRegenerate?: (messageId: string) => void;
  /** 该条助手消息是否正在流式输出（决定是否走打字机 + 末尾光标） */
  streaming?: boolean;
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

/**
 * 消息气泡：排版与配色全部走 .vc-msg 体系（主题变量 + 玻璃层），
 * 用户消息右对齐主色气泡，助手消息左对齐玻璃气泡，hover 才显操作按钮。
 */
const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  showAvatar = true,
  onRegenerate,
  streaming = false,
}) => {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  // 助手消息流式期间按字符吐字；用户消息/历史消息直接原样显示
  const { text: shownContent, typing } = useTypewriter(message.content, streaming && !isUser);
  // 模型还没吐出第一个 token（TTFT 常 4~8s）：先显示呼吸点占位
  const waitingFirstToken = !isUser && streaming && !message.content;

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
    <div className={'vc-msg' + (isUser ? ' is-user' : '')}>
      {/* 头像：连续同角色消息不显示，保持紧凑 */}
      {showAvatar && (
        <div className={'vc-msg__avatar' + (isUser ? ' vc-msg__avatar--user' : '')}>
          <Icon icon={isUser ? userIcon : botIcon} width={18} />
        </div>
      )}

      {/* 消息内容 */}
      <div
        className={
          'vc-msg__body' +
          (!showAvatar ? (isUser ? ' vc-msg__body--indent-end' : ' vc-msg__body--indent') : '')
        }
      >
        <div className="vc-msg__bubble">
          {isUser ? (
            <div className="vc-msg__text">{message.content}</div>
          ) : waitingFirstToken ? (
            // 首个 token 还没到（模型 TTFT 常 4~8s）：给个呼吸点，别让气泡空着只剩一根光标
            <div className="vc-msg__thinking" aria-label="正在生成回答">
              <span />
              <span />
              <span />
            </div>
          ) : (
            <div className="md-body">
              <ReactMarkdown>{shownContent}</ReactMarkdown>
              {typing && <span className="vc-msg__caret" aria-hidden />}
            </div>
          )}
        </div>

        {/* 时间戳 + hover 操作 */}
        <div className="vc-msg__meta">
          <span className="vc-msg__time">{formatTime(message.timestamp)}</span>
          <button
            className={'vc-msg__action' + (copied ? ' is-copied' : '')}
            onClick={handleCopy}
            title="复制"
            aria-label="复制消息"
          >
            <Icon icon={copied ? checkIcon : copyIcon} width={12} />
          </button>
          {!isUser && onRegenerate && (
            <button className="vc-msg__action" onClick={() => onRegenerate(message.id)} title="重新生成" aria-label="重新生成">
              <Icon icon={refreshIcon} width={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
