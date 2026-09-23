import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Input, Button, Empty, Spin, Popconfirm, Dropdown, Modal, message, Tooltip, Select } from 'antd';
import type { TextAreaRef } from 'antd/es/input/TextArea';
import { Icon } from '@iconify/react';
import searchIcon from '@iconify-icons/lucide/search';
import plusIcon from '@iconify-icons/lucide/plus';
import trashIcon from '@iconify-icons/lucide/trash-2';
import sendIcon from '@iconify-icons/lucide/send';
import bookOpenIcon from '@iconify-icons/lucide/book-open';
import messageSquareIcon from '@iconify-icons/lucide/message-square';
import moreHorizontalIcon from '@iconify-icons/lucide/more-horizontal';
import pencilIcon from '@iconify-icons/lucide/pencil';
import paperclipIcon from '@iconify-icons/lucide/paperclip';
import globeIcon from '@iconify-icons/lucide/globe';
import micIcon from '@iconify-icons/lucide/mic';
import MessageBubble from '@/components/MessageBubble';
import CollapsibleSidebar from '@/components/CollapsibleSidebar';
import { getConversations, createConversation, deleteConversation, sendMessage } from '@/api/chat';
import type { Conversation, Message } from '@/types';
import { formatRelativeTime } from '@/utils/formatTime';
import { useTheme } from '@/contexts/ThemeContext';
import { useSettingsStore, modelId } from '@/stores/settingsStore';

/** 侧栏宽度（与 Knowledge 页保持一致） */
const SIDEBAR_WIDTH = 280;

/** 新对话空状态的推荐问题 */
const SUGGESTED_PROMPTS = [
  '帮我设计一个高并发 AI 推理服务的架构',
  'React 项目性能优化有哪些关键点？',
  '怎么用 DDD 拆分一个电商系统的微服务？',
];

const ChatPage: React.FC = () => {
  const { colors, isDark } = useTheme();
  const glassEnabled = useSettingsStore((s) => s.glassEnabled);
  const models = useSettingsStore((s) => s.models);
  const currentModelId = useSettingsStore((s) => s.currentModelId);
  const loadingModels = useSettingsStore((s) => s.loadingModels);
  const loadModels = useSettingsStore((s) => s.loadModels);
  const setCurrentModel = useSettingsStore((s) => s.setCurrentModel);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hoveredConvId, setHoveredConvId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<TextAreaRef>(null);

  // 当前活跃会话
  const activeConv = conversations.find((c) => c.id === activeConvId) || null;

  /** 从绑定模型解析当前生效模型：会话已绑定优先，否则取 currentModelId */
  const activeModel = useMemo(() => {
    if (activeConv?.vendor && activeConv.modelCode) {
      return {
        vendor: activeConv.vendor,
        modelCode: activeConv.modelCode,
        modelName: activeConv.modelName,
      };
    }
    if (!currentModelId) return null;
    const [v, c] = currentModelId.split(':');
    const m = models.find((x) => x.vendor === v && x.modelCode === c);
    return { vendor: v, modelCode: c, modelName: m?.modelName };
  }, [activeConv?.vendor, activeConv?.modelCode, activeConv?.modelName, currentModelId, models]);

  // 加载会话列表 + 我的绑定模型
  useEffect(() => {
    loadConversations();
    void loadModels();
  }, []);

  const loadConversations = async () => {
    setLoading(true);
    const data = await getConversations();
    setConversations(data);
    if (data.length > 0 && !activeConvId) {
      setActiveConvId(data[0].id);
    }
    setLoading(false);
  };

  // 滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConv?.messages?.length]);

  // 搜索过滤
  const filteredConvs = conversations.filter(
    (c) =>
      c.title.toLowerCase().includes(searchText.toLowerCase()) ||
      c.lastMessage.toLowerCase().includes(searchText.toLowerCase())
  );

  // 新建会话
  const handleCreate = async () => {
    const newConv = await createConversation('新对话');
    setConversations((prev) => [newConv, ...prev]);
    setActiveConvId(newConv.id);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  // 删除会话（用 prev 避免 stale closure）
  const handleDelete = async (id: string) => {
    await deleteConversation(id);
    setConversations((prev) => {
      const next = prev.filter((c) => c.id !== id);
      if (activeConvId === id) {
        setActiveConvId(next.length > 0 ? next[0].id : null);
      }
      return next;
    });
  };

  // 重命名会话
  const handleRename = (id: string) => {
    const conv = conversations.find((c) => c.id === id);
    if (!conv) return;
    Modal.confirm({
      title: '重命名对话',
      content: (
        <Input
          defaultValue={conv.title}
          id="rename-input"
          onPressEnter={(e) => {
            const v = (e.target as HTMLInputElement).value.trim();
            if (v) {
              setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title: v } : c)));
              message.success('已重命名');
            }
          }}
        />
      ),
      onOk: () => {
        const v = (document.getElementById('rename-input') as HTMLInputElement)?.value.trim();
        if (v) {
          setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title: v } : c)));
        }
      },
      okText: '保存',
      cancelText: '取消',
    });
  };

  // 发送消息
  const handleSend = useCallback(async (text?: string) => {
    const content = (text ?? inputValue).trim();
    if (!content || !activeConvId || sending) return;

    // 无可用模型：引导去配置
    if (!activeModel) {
      message.warning('请先到「设置 → 模型配置」绑定并选择模型');
      return;
    }

    setInputValue('');
    setSending(true);

    const now = Date.now();
    const userMsg: Message = {
      id: `msg-${now}-user`,
      role: 'user',
      content,
      timestamp: now,
    };

    const aiText = await sendMessage(content, activeModel.vendor, activeModel.modelCode);
    const aiMsg: Message = {
      id: `msg-${now}-ai`,
      role: 'assistant',
      content: aiText,
      timestamp: now + 1000,
    };
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConvId
          ? {
              ...c,
              // 发送后把模型绑定到会话（会话期间锁定不可切换）
              vendor: activeModel.vendor,
              modelCode: activeModel.modelCode,
              modelName: activeModel.modelName,
              messages: [...c.messages, userMsg, aiMsg],
              lastMessage: aiText,
              updatedAt: now + 1000,
            }
          : c
      )
    );
    setSending(false);
  }, [inputValue, activeConvId, sending, activeModel]);

  // 重新生成：找到该会话最后一条 user 消息内容，再发一次
  const handleRegenerate = useCallback(async (messageId: string) => {
    if (!activeConv || sending) return;
    if (!activeConv.vendor || !activeConv.modelCode) {
      message.warning('该会话未绑定模型');
      return;
    }
    const msgs = activeConv.messages;
    const idx = msgs.findIndex((m) => m.id === messageId);
    // 找该 AI 回复之前最近一条 user 消息
    let userContent = '';
    for (let i = idx - 1; i >= 0; i--) {
      if (msgs[i].role === 'user') {
        userContent = msgs[i].content;
        break;
      }
    }
    if (!userContent) return;
    setSending(true);
    const aiText = await sendMessage(userContent, activeConv.vendor, activeConv.modelCode);
    const aiMsg: Message = {
      id: `msg-${Date.now()}-ai`,
      role: 'assistant',
      content: aiText,
      timestamp: Date.now(),
    };
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConv.id
          ? { ...c, messages: [...c.messages, aiMsg], lastMessage: aiText, updatedAt: Date.now() }
          : c
      )
    );
    setSending(false);
  }, [activeConv, sending]);

  // 键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 判断某条消息是否该显示头像（连续 assistant 只显示首条）
  const shouldShowAvatar = (index: number, list: Message[]): boolean => {
    if (list[index].role === 'user') return true;
    if (index === 0) return true;
    return list[index - 1].role !== 'assistant';
  };

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* 左侧面板 - 会话列表（可折叠） */}
      <CollapsibleSidebar width={SIDEBAR_WIDTH}>
        {/* 搜索框 */}
        <div style={{ padding: '16px 12px 8px' }}>
          <Input
            prefix={<Icon icon={searchIcon} width={14} style={{ color: colors.textTertiary }} />}
            placeholder="搜索对话..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
            style={{ borderRadius: 20 }}
          />
        </div>

        {/* 新建会话按钮（描边样式，避免与选中态实心撞色） */}
        <div style={{ padding: '0 12px 8px' }}>
          <Button
            icon={<Icon icon={plusIcon} width={14} />}
            onClick={handleCreate}
            block
            style={{ borderRadius: 'var(--radius-md)' }}
          >
            新建对话
          </Button>
        </div>

        {/* 会话列表 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <Spin />
            </div>
          ) : filteredConvs.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="暂无对话"
              style={{ marginTop: 40 }}
            />
          ) : (
            filteredConvs.map((conv) => {
              const isActive = conv.id === activeConvId;
              const isHovered = conv.id === hoveredConvId;
              return (
                <div
                  key={conv.id}
                  style={{ position: 'relative', marginBottom: 2 }}
                  onMouseEnter={() => setHoveredConvId(conv.id)}
                  onMouseLeave={() => setHoveredConvId(null)}
                >
                  <div
                    onClick={() => setActiveConvId(conv.id)}
                    style={{
                      // hover 时右侧内边距增大，为删除按钮腾出空间，内容平滑缩短
                      padding: `12px ${isHovered ? 42 : 12}px 12px 12px`,
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      background: isActive ? colors.primary10 : 'transparent',
                      border: isActive
                        ? `1px solid ${colors.primary30}`
                        : '1px solid transparent',
                      color: isActive ? colors.primary : colors.text,
                      transition: 'padding 0.18s var(--spring), background 0.15s, border-color 0.15s',
                    }}
                  >
                    {/* 标题行 */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 4,
                      }}
                    >
                      <Icon
                        icon={messageSquareIcon}
                        width={14}
                        style={{ flexShrink: 0, opacity: 0.7 }}
                      />
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          flex: 1,
                        }}
                      >
                        {conv.title}
                      </span>
                    </div>

                    {/* 最后消息预览 */}
                    <div
                      style={{
                        fontSize: 12,
                        color: colors.textSecondary,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        paddingLeft: 22,
                      }}
                    >
                      {conv.lastMessage || '暂无消息'}
                    </div>

                    {/* 底部：创建时间 + 知识库标识 */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        paddingLeft: 22,
                        marginTop: 4,
                      }}
                    >
                      <span style={{ fontSize: 10, color: colors.textTertiary }}>
                        {formatRelativeTime(conv.createdAt)}
                      </span>
                      {conv.knowledgeBaseId && (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                            padding: '1px 6px',
                            borderRadius: 'var(--radius-full)',
                            fontSize: 10,
                            background: colors.primary15,
                            color: colors.primary,
                          }}
                        >
                          <Icon icon={bookOpenIcon} width={10} />
                          知识库
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 删除按钮：垂直居中浮在右侧，hover 时随内容右缩淡入 */}
                  <div
                    style={{
                      position: 'absolute',
                      right: 8,
                      top: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: isHovered ? 1 : 0,
                      transform: isHovered
                        ? 'translateY(-50%)'
                        : 'translateY(calc(-50% + 4px))',
                      transition: 'opacity 0.18s, transform 0.18s var(--spring)',
                      zIndex: 2,
                      pointerEvents: isHovered ? 'auto' : 'none',
                    }}
                  >
                    <Popconfirm
                      title="删除对话"
                      description="删除后不可恢复，确认删除？"
                      onConfirm={() => handleDelete(conv.id)}
                      okText="删除"
                      cancelText="取消"
                      placement="left"
                    >
                      <button
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          color: colors.error,
                          padding: 4,
                          display: 'flex',
                          borderRadius: 4,
                        }}
                      >
                        <Icon icon={trashIcon} width={14} />
                      </button>
                    </Popconfirm>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CollapsibleSidebar>

      {/* 右侧聊天窗口 */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
        }}
      >
        {activeConv ? (
          <>
            {/* 聊天标题栏 */}
            <div
              key={`header-${activeConv.id}`}
              className="chat-panel-fade-in"
              style={{
                padding: '12px 24px',
                borderBottom: `1px solid ${colors.divider}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <Icon icon={messageSquareIcon} width={18} style={{ color: colors.primary, flexShrink: 0 }} />
                <span
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {activeConv.title}
                </span>
              </div>
              <Dropdown
                trigger={['click']}
                menu={{
                  items: [
                    {
                      key: 'rename',
                      icon: <Icon icon={pencilIcon} width={14} />,
                      label: '重命名',
                      onClick: () => handleRename(activeConv.id),
                    },
                    {
                      key: 'delete',
                      icon: <Icon icon={trashIcon} width={14} />,
                      label: (
                        <Popconfirm
                          title="删除对话"
                          description="删除后不可恢复，确认删除？"
                          onConfirm={() => handleDelete(activeConv.id)}
                          okText="删除"
                          cancelText="取消"
                        >
                          <span style={{ color: colors.error }}>删除对话</span>
                        </Popconfirm>
                      ),
                    },
                  ],
                }}
                placement="bottomRight"
              >
                <Button
                  type="text"
                  icon={<Icon icon={moreHorizontalIcon} width={18} />}
                />
              </Dropdown>
            </div>

            {/* 消息列表：key 跟随会话 id，切换对话时整体淡入 */}
            <div
              key={activeConv.id}
              className="chat-panel-fade-in"
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '20px 24px',
              }}
            >
              {activeConv.messages.length === 0 ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    gap: 16,
                  }}
                >
                  <Icon
                    icon={messageSquareIcon}
                    width={48}
                    style={{ color: colors.textTertiary, opacity: 0.4 }}
                  />
                  <span style={{ color: colors.textSecondary, fontSize: 14 }}>
                    开始新的对话吧
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 480 }}>
                    {SUGGESTED_PROMPTS.map((q) => (
                      <button
                        key={q}
                        onClick={() => handleSend(q)}
                        style={{
                          padding: '10px 14px',
                          borderRadius: 'var(--radius-md)',
                          border: `1px solid ${colors.border}`,
                          background: colors.surface,
                          color: colors.text,
                          cursor: 'pointer',
                          textAlign: 'left',
                          fontSize: 13,
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.background = colors.primary10;
                          (e.currentTarget as HTMLButtonElement).style.borderColor = colors.primary30;
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.background = colors.surface;
                          (e.currentTarget as HTMLButtonElement).style.borderColor = colors.border;
                        }}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                activeConv.messages.map((msg, idx) => (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    showAvatar={shouldShowAvatar(idx, activeConv.messages)}
                    onRegenerate={handleRegenerate}
                  />
                ))
              )}
              {sending && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 48, marginBottom: 20 }}>
                  <Spin size="small" />
                  <span style={{ fontSize: 12, color: colors.textTertiary }}>
                    AI 正在思考...
                  </span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* 输入区域 */}
            <div
              style={{
                padding: '12px 24px 16px',
                borderTop: `1px solid ${colors.divider}`,
              }}
            >
              {/* 模型选择行 */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 8,
                  minHeight: 32,
                }}
              >
                {models.length === 0 ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 12,
                      color: colors.textSecondary,
                      background: colors.primary10,
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-md)',
                    }}
                  >
                    尚未绑定任何模型，请先
                    <a
                      href="/settings/providers"
                      style={{ color: colors.primary, fontWeight: 600 }}
                    >
                      去配置模型
                    </a>
                  </div>
                ) : (
                  <>
                    <Select
                      size="small"
                      style={{ width: 220 }}
                      value={
                        activeConv?.vendor
                          ? modelId(activeConv.vendor, activeConv.modelCode!)
                          : currentModelId ?? undefined
                      }
                      placeholder="选择模型"
                      options={models.map((m) => ({
                        value: modelId(m.vendor, m.modelCode),
                        label: `${m.modelName}（${m.vendor}）`,
                      }))}
                      onChange={(id) => setCurrentModel(id)}
                      disabled={!!activeConv?.vendor || loadingModels}
                      popupMatchSelectWidth={false}
                    />
                    {activeConv?.vendor && (
                      <span style={{ fontSize: 11, color: colors.textTertiary }}>
                        会话已绑定模型，创建新对话可切换
                      </span>
                    )}
                  </>
                )}
              </div>
              <div
                className="composer-glow"
                style={{
                  borderRadius: 20,
                  background: colors.surfaceElevated,
                  padding: '10px 16px',
                  boxShadow: `
                    0 0 0 1.5px ${colors.primary}99,
                    0 0 24px ${colors.primary}35,
                    0 8px 32px ${isDark ? 'rgba(0,0,0,0.35)' : 'rgba(31,38,135,0.12)'},
                    inset 0 1px 0 ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.6)'}
                  `,
                  backdropFilter: glassEnabled ? 'blur(20px) saturate(180%)' : undefined,
                  WebkitBackdropFilter: glassEnabled ? 'blur(20px) saturate(180%)' : undefined,
                }}
              >
                <Input.TextArea
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="输入消息，Enter 发送，Shift+Enter 换行"
                  autoSize={{ minRows: 1, maxRows: 4 }}
                  bordered={false}
                  style={{ background: 'transparent', resize: 'none' }}
                />
                {/* 工具行 + 发送 */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginTop: 4,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Tooltip title="附件（demo）">
                      <button
                        style={{
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          color: colors.textSecondary,
                          padding: 6,
                          borderRadius: 6,
                          display: 'flex',
                        }}
                      >
                        <Icon icon={paperclipIcon} width={16} />
                      </button>
                    </Tooltip>
                    <Tooltip title="联网搜索（demo）">
                      <button
                        style={{
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          color: colors.textSecondary,
                          padding: 6,
                          borderRadius: 6,
                          display: 'flex',
                        }}
                      >
                        <Icon icon={globeIcon} width={16} />
                      </button>
                    </Tooltip>
                    <Tooltip title="语音输入（demo）">
                      <button
                        style={{
                          border: 'none',
                          background: 'transparent',
                          cursor: 'pointer',
                          color: colors.textSecondary,
                          padding: 6,
                          borderRadius: 6,
                          display: 'flex',
                        }}
                      >
                        <Icon icon={micIcon} width={16} />
                      </button>
                    </Tooltip>
                  </div>
                  <Button
                    type="primary"
                    icon={<Icon icon={sendIcon} width={14} />}
                    onClick={() => handleSend()}
                    loading={sending}
                    disabled={!inputValue.trim()}
                    shape="circle"
                  />
                </div>
              </div>
            </div>
          </>
        ) : (
          /* 空状态 */
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              gap: 16,
            }}
          >
            <Icon
              icon={messageSquareIcon}
              width={64}
              style={{ color: colors.textTertiary, opacity: 0.3 }}
            />
            <span style={{ color: colors.textSecondary, fontSize: 16 }}>
              选择或创建一个对话
            </span>
            <Button
              type="primary"
              icon={<Icon icon={plusIcon} width={14} />}
              onClick={handleCreate}
            >
              新建对话
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatPage;
