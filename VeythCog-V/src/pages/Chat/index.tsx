import { createConversation, deleteConversation, getConversationMessages, getConversations, streamChatMessage, updateConversation } from '@/api/chat';
import { listDocs } from '@/api/knowledge';
import CollapsibleSidebar from '@/components/CollapsibleSidebar';
import MessageBubble from '@/components/MessageBubble';
import { ModelModalityIcons } from '@/components/ModelTypeTag';
import type { DocListItem, Conversation, Message } from '@/types';
import { modelId, useSettingsStore } from '@/stores/settingsStore';
import { formatRelativeTime } from '@/utils/formatTime';
import bookOpenIcon from '@iconify-icons/lucide/book-open';
import databaseIcon from '@iconify-icons/lucide/database';
import globeIcon from '@iconify-icons/lucide/globe';
import messageSquareIcon from '@iconify-icons/lucide/message-square';
import micIcon from '@iconify-icons/lucide/mic';
import moreHorizontalIcon from '@iconify-icons/lucide/more-horizontal';
import paperclipIcon from '@iconify-icons/lucide/paperclip';
import pencilIcon from '@iconify-icons/lucide/pencil';
import plusIcon from '@iconify-icons/lucide/plus';
import searchIcon from '@iconify-icons/lucide/search';
import sendIcon from '@iconify-icons/lucide/send';
import trashIcon from '@iconify-icons/lucide/trash-2';
import zapIcon from '@iconify-icons/lucide/zap';
import { Icon } from '@iconify/react';
import { Button, Checkbox, Drawer, Dropdown, Input, message, Modal, Popconfirm, Select, Spin, Switch, Tag, Tooltip } from 'antd';
import type { TextAreaRef } from 'antd/es/input/TextArea';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/** 侧栏宽度（与 Knowledge 页保持一致） */
const SIDEBAR_WIDTH = 280;

/** 对话输入框可拖拽高度范围 */
const MIN_COMPOSER_HEIGHT = 44;
const MAX_COMPOSER_HEIGHT = 440;

/** 新对话空状态的推荐问题 */
const SUGGESTED_PROMPTS = [
  '帮我设计一个高并发 AI 推理服务的架构',
  'React 项目性能优化有哪些关键点？',
  '怎么用 DDD 拆分一个电商系统的微服务？',
];

const ChatPage: React.FC = () => {
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
  const [composerHeight, setComposerHeight] = useState(MIN_COMPOSER_HEIGHT);
  const resizeCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => resizeCleanupRef.current?.();
  }, []);

  // 从导航搜索 AI 的「继续追问」进入时，把问题带进输入框
  useEffect(() => {
    const prefill = new URLSearchParams(window.location.search).get('prefill');
    if (!prefill) return;
    setInputValue(prefill);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => window.clearTimeout(timer);
  }, []);

  // 知识库抽屉状态
  const [kbDrawerOpen, setKbDrawerOpen] = useState(false);
  const [kbDocs, setKbDocs] = useState<DocListItem[]>([]);
  const [kbLoading, setKbLoading] = useState(false);

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
    try {
      const data = await getConversations();
      setConversations(data);
      if (data.length > 0 && !activeConvId) {
        setActiveConvId(data[0].id);
      }
    } catch (e) {
      // 列表拉取失败不阻塞页面（新会话仍可创建与发送）
      message.error(e instanceof Error ? e.message : '会话列表加载失败');
    } finally {
      setLoading(false);
    }
  };

  // 切换会话时按需加载真实历史（会话列表只带摘要，消息体单独拉取）
  useEffect(() => {
    if (!activeConvId) return;
    const target = conversations.find((c) => c.id === activeConvId);
    if (!target || target.messages.length > 0) return;
    let cancelled = false;
    (async () => {
      try {
        const msgs = await getConversationMessages(activeConvId);
        if (cancelled || msgs.length === 0) return;
        setConversations((prev) =>
          prev.map((c) => (c.id === activeConvId ? { ...c, messages: msgs } : c))
        );
      } catch {
        // 历史加载失败不阻塞对话（新建会话本就没有历史）
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConvId]);

  // 打开知识库抽屉并加载文档
  const openKbDrawer = () => {
    setKbDrawerOpen(true);
    void loadKbDocs();
  };

  const loadKbDocs = async () => {
    setKbLoading(true);
    try {
      const page = await listDocs({ current: 1, pageSize: 100 });
      setKbDocs(page.records ?? []);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载知识库文档失败');
    } finally {
      setKbLoading(false);
    }
  };

  // 更新当前会话选中的知识库文档（立即写回 chat_session，刷新后仍生效）
  const setSelectedDocIds = (ids: number[]) => {
    if (!activeConvId) return;
    const prevIds = activeConv?.knowledgeDocIds ?? [];
    setConversations((prev) =>
      prev.map((c) => (c.id === activeConvId ? { ...c, knowledgeDocIds: ids } : c))
    );
    void updateConversation(activeConvId, { docIds: ids }).catch((e) => {
      setConversations((prev) =>
        prev.map((c) => (c.id === activeConvId ? { ...c, knowledgeDocIds: prevIds } : c))
      );
      message.error(e instanceof Error ? e.message : '知识库范围保存失败');
    });
  };

  /** 会话级上下文压缩开关（写回后端，失败回滚） */
  const toggleCompress = (enabled: boolean) => {
    if (!activeConvId) return;
    const prevValue = activeConv?.compressEnabled !== false;
    setConversations((prev) =>
      prev.map((c) => (c.id === activeConvId ? { ...c, compressEnabled: enabled } : c))
    );
    void updateConversation(activeConvId, { compressEnabled: enabled }).catch((e) => {
      setConversations((prev) =>
        prev.map((c) => (c.id === activeConvId ? { ...c, compressEnabled: prevValue } : c))
      );
      message.error(e instanceof Error ? e.message : '压缩开关保存失败');
    });
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

  // 新建会话（同时落 chat_session，未发消息也会出现在列表里）
  const handleCreate = async () => {
    try {
      const model = currentModelId
        ? (() => {
            const [v, c] = currentModelId.split(':');
            return { vendor: v, modelCode: c, modelName: models.find((m) => m.vendor === v && m.modelCode === c)?.modelName };
          })()
        : undefined;
      const newConv = await createConversation('新对话', model);
      setConversations((prev) => [newConv, ...prev]);
      setActiveConvId(newConv.id);
      setTimeout(() => inputRef.current?.focus(), 0);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '新建对话失败');
    }
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

  // 重命名会话（写回 chat_session）
  const handleRename = (id: string) => {
    const conv = conversations.find((c) => c.id === id);
    if (!conv) return;
    const applyRename = (value: string) => {
      const v = value.trim();
      if (!v || v === conv.title) return;
      setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title: v } : c)));
      void updateConversation(id, { title: v }).catch((e) => {
        setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title: conv.title } : c)));
        message.error(e instanceof Error ? e.message : '重命名失败');
      });
    };
    Modal.confirm({
      title: '重命名对话',
      content: (
        <Input
          defaultValue={conv.title}
          id="rename-input"
          onPressEnter={(e) => {
            applyRename((e.target as HTMLInputElement).value);
            message.success('已重命名');
          }}
        />
      ),
      onOk: () => {
        const v = (document.getElementById('rename-input') as HTMLInputElement)?.value ?? '';
        applyRename(v);
        message.success('已重命名');
      },
      okText: '保存',
      cancelText: '取消',
    });
  };

  const streamingMsgIdRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // 组件卸载时中断未完成流
  useEffect(() => () => abortRef.current?.abort(), []);

  // 流式回复：SSE 逐 token 增量填充到指定 assistant 消息；引用由后端先下发
  const streamReply = useCallback(
    (
      content: string,
      vendor: string,
      modelCode: string,
      conversationId: string,
      assistantId: string,
      docIds?: number[],
      compressEnabled = true
    ) => {
      abortRef.current?.abort();
      abortRef.current = streamChatMessage({
        message: content,
        vendor,
        modelCode,
        conversationId,
        docIds,
        compressEnabled,
        onReferences: (refs) => {
          const id = streamingMsgIdRef.current;
          if (!id || refs.length === 0) return;
          setConversations((prev) =>
            prev.map((c) =>
              c.id === conversationId
                ? {
                    ...c,
                    messages: c.messages.map((m) =>
                      m.id === id ? { ...m, references: refs } : m
                    ),
                  }
                : c
            )
          );
        },
        onDelta: (t) => {
          const id = streamingMsgIdRef.current;
          if (!id) return;
          setConversations((prev) =>
            prev.map((c) =>
              c.id === conversationId
                ? { ...c, messages: c.messages.map((m) => (m.id === id ? { ...m, content: m.content + t } : m)) }
                : c
            )
          );
        },
        onDone: () => {
          const id = streamingMsgIdRef.current;
          streamingMsgIdRef.current = null;
          abortRef.current = null;
          setConversations((prev) =>
            prev.map((c) =>
              c.id === conversationId
                ? { ...c, lastMessage: (c.messages.find((m) => m.id === id)?.content) || c.lastMessage, updatedAt: Date.now() }
                : c
            )
          );
          setSending(false);
        },
        onError: (e) => {
          const id = streamingMsgIdRef.current;
          streamingMsgIdRef.current = null;
          abortRef.current = null;
          // 失败且未生成任何内容时，移除空的 AI 占位气泡
          setConversations((prev) =>
            prev.map((c) =>
              c.id === conversationId
                ? { ...c, messages: c.messages.filter((m) => !(m.id === id && !m.content)) }
                : c
            )
          );
          message.error(e instanceof Error ? e.message : '请求失败，请稍后重试');
          setSending(false);
        },
      });
    },
    []
  );

  // 发送消息（RAG 由后端统一检索并拼上下文，引用随 SSE references 事件下发）
  const handleSend = useCallback(async (text?: string) => {
    const content = (text ?? inputValue).trim();
    if (!content || !activeConvId || sending) return;

    // 无可用模型：引导去配置
    if (!activeModel) {
      message.warning('请先到「设置 → 模型配置」绑定并选择模型');
      return;
    }

    const docIds = activeConv?.knowledgeDocIds ?? [];

    setInputValue('');
    setSending(true);

    const now = Date.now();
    const userMsg: Message = {
      id: `msg-${now}-user`,
      role: 'user',
      content,
      timestamp: now,
    };
    const aiId = `msg-${Date.now()}-ai`;
    streamingMsgIdRef.current = aiId;

    // 乐观更新：用户消息 + 空 AI 占位立即上屏，随后 SSE 逐 token 填充
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConvId
          ? {
              ...c,
              // 发送后把模型绑定到会话（会话期间锁定不可切换）
              vendor: activeModel.vendor,
              modelCode: activeModel.modelCode,
              modelName: activeModel.modelName,
              messages: [...c.messages, userMsg, { id: aiId, role: 'assistant', content: '', timestamp: now }],
              lastMessage: content,
              updatedAt: now,
            }
          : c
      )
    );

    streamReply(content, activeModel.vendor, activeModel.modelCode, activeConvId, aiId, docIds, activeConv?.compressEnabled !== false);
  }, [inputValue, activeConvId, sending, activeModel, activeConv]);

  // 重新生成：找到该会话最后一条 user 消息内容，再流式重发
  const handleRegenerate = useCallback((messageId: string) => {
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
    const aiId = `msg-${Date.now()}-ai`;
    streamingMsgIdRef.current = aiId;
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConv.id
          ? { ...c, messages: [...c.messages, { id: aiId, role: 'assistant', content: '', timestamp: Date.now() }] }
          : c
      )
    );
    streamReply(
      userContent,
      activeConv.vendor,
      activeConv.modelCode,
      activeConv.id,
      aiId,
      activeConv.knowledgeDocIds ?? [],
      activeConv.compressEnabled !== false
    );
  }, [activeConv, sending]);

  // 键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const composerMaxHeight = Math.max(
    180,
    Math.min(MAX_COMPOSER_HEIGHT, window.innerHeight * 0.55),
  );

  const clampComposerHeight = (height: number) =>
    Math.min(composerMaxHeight, Math.max(MIN_COMPOSER_HEIGHT, height));

  /** 从输入框顶部把手向上拖拽，增加输入框高度 */
  const handleComposerResizeStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();

    const startY = e.clientY;
    const startHeight = composerHeight;
    const prevUserSelect = document.body.style.userSelect;
    const prevCursor = document.body.style.cursor;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ns-resize';

    const onMove = (ev: PointerEvent) => {
      setComposerHeight(clampComposerHeight(startHeight + startY - ev.clientY));
    };

    const cleanup = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', cleanup);
      window.removeEventListener('pointercancel', cleanup);
      document.body.style.userSelect = prevUserSelect;
      document.body.style.cursor = prevCursor;
      resizeCleanupRef.current = null;
    };

    resizeCleanupRef.current?.();
    resizeCleanupRef.current = cleanup;
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', cleanup);
    window.addEventListener('pointercancel', cleanup);
  };

  const handleComposerResizeKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    setComposerHeight((h) => clampComposerHeight(h + (e.key === 'ArrowUp' ? 24 : -24)));
  };

  // 判断某条消息是否该显示头像（连续 assistant 只显示首条）
  const shouldShowAvatar = (index: number, list: Message[]): boolean => {
    if (list[index].role === 'user') return true;
    if (index === 0) return true;
    return list[index - 1].role !== 'assistant';
  };

  return (
    <div className="vc-subnav-layout vc-chat">
      {/* 左侧面板 - 会话列表（可折叠） */}
      <CollapsibleSidebar width={SIDEBAR_WIDTH}>
        <div className="vc-chat-nav__head">
          <Input
            prefix={<Icon icon={searchIcon} width={14} className="vc-search-icon" />}
            placeholder="搜索对话..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
          />
          <Button icon={<Icon icon={plusIcon} width={14} />} onClick={handleCreate} block>
            新建对话
          </Button>
        </div>

        <div className="vc-chat-list">
          {loading ? (
            <div className="vc-chat-list__loading">
              <Spin />
            </div>
          ) : filteredConvs.length === 0 ? (
            <div className="vc-chat-list__empty">暂无对话</div>
          ) : (
            filteredConvs.map((conv) => {
              const isActive = conv.id === activeConvId;
              const isHovered = conv.id === hoveredConvId;
              return (
                <div
                  key={conv.id}
                  className="vc-conv-item-wrap"
                  onMouseEnter={() => setHoveredConvId(conv.id)}
                  onMouseLeave={() => setHoveredConvId(null)}
                >
                  <div
                    className={'vc-conv-item' + (isActive ? ' is-active' : '') + (isHovered ? ' is-hovered' : '')}
                    onClick={() => setActiveConvId(conv.id)}
                  >
                    <div className="vc-conv-item__row">
                      <Icon icon={messageSquareIcon} width={14} className="vc-conv-item__icon" />
                      <span className="vc-conv-item__title">{conv.title}</span>
                    </div>
                    <div className="vc-conv-item__preview">{conv.lastMessage || '暂无消息'}</div>
                    <div className="vc-conv-item__meta">
                      <span className="vc-conv-item__time">{formatRelativeTime(conv.createdAt)}</span>
                      {conv.knowledgeBaseId && (
                        <span className="vc-conv-item__badge">
                          <Icon icon={bookOpenIcon} width={10} />
                          知识库
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 删除按钮：垂直居中浮在右侧，hover 时随内容右缩淡入 */}
                  <div className={'vc-conv-item__delete' + (isHovered ? ' is-shown' : '')}>
                    <Popconfirm
                      title="删除对话"
                      description="删除后不可恢复，确认删除？"
                      onConfirm={() => handleDelete(conv.id)}
                      okText="删除"
                      cancelText="取消"
                      placement="left"
                    >
                      <button onClick={(e) => e.stopPropagation()} aria-label="删除对话">
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
      <div className="vc-chat-main">
        {activeConv ? (
          <>
            {/* 聊天标题栏 */}
            <div key={`header-${activeConv.id}`} className="vc-chat-head chat-panel-fade-in">
              <div className="vc-chat-head__main">
                <Icon icon={messageSquareIcon} width={18} className="vc-chat-head__icon" />
                <span className="vc-chat-head__title">{activeConv.title}</span>
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
                          <span className="vc-danger-text">删除对话</span>
                        </Popconfirm>
                      ),
                    },
                  ],
                }}
                placement="bottomRight"
              >
                <Button type="text" icon={<Icon icon={moreHorizontalIcon} width={18} />} />
              </Dropdown>
            </div>

            {/* 消息列表：key 跟随会话 id，切换对话时整体淡入 */}
            <div key={activeConv.id} className="vc-chat-scroll chat-panel-fade-in">
              {activeConv.messages.length === 0 ? (
                <div className="vc-chat-empty">
                  <span className="vc-chat-empty__icon">
                    <Icon icon={messageSquareIcon} width={32} />
                  </span>
                  <span className="vc-chat-empty__title">开始新的对话吧</span>
                  <div className="vc-suggest">
                    <span className="vc-suggest__label">试试这些问题</span>
                    {SUGGESTED_PROMPTS.map((q) => (
                      <button key={q} className="vc-suggest__item" onClick={() => handleSend(q)}>
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                activeConv.messages.map((msg, idx) => (
                  <React.Fragment key={msg.id}>
                    {msg.references && msg.references.length > 0 && (
                      <div className="vc-refs">
                        <div className="vc-refs__head">
                          <Icon icon={databaseIcon} width={12} />
                          引用自知识库（{msg.references.length} 条）
                        </div>
                        {msg.references.map((r, i) => (
                          <div key={i} className="vc-ref-card">
                            <div className="vc-ref-card__head">
                              <Icon icon={zapIcon} width={12} className="vc-ref-card__icon" />
                              <span className="vc-ref-card__title">{r.title}</span>
                              <span className="vc-tag-soft">分片 #{r.chunkIndex} · 距离 {r.score.toFixed(3)}</span>
                            </div>
                            <div className="vc-ref-card__text">
                              {r.chunkText.length > 200 ? `${r.chunkText.slice(0, 200)}…` : r.chunkText}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <MessageBubble
                      message={msg}
                      showAvatar={shouldShowAvatar(idx, activeConv.messages)}
                      onRegenerate={handleRegenerate}
                    />
                  </React.Fragment>
                ))
              )}
              {sending && (
                <div className="vc-chat-thinking">
                  <Spin size="small" />
                  <span>AI 正在思考...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* 输入区域 */}
            <div className="vc-composer-wrap">
              {/* 没有可用模型时给出配置入口；正常情况模型下拉放在输入工具栏内 */}
              {models.length === 0 && (
                <div className="vc-composer-tip">
                  没有通过连通校验的模型，请先
                  <a href="/settings/providers">去模型配置页校验</a>
                </div>
              )}
              <div
                className="composer-resize-handle"
                role="slider"
                aria-label="拖动调整输入框高度"
                aria-orientation="vertical"
                aria-valuemin={MIN_COMPOSER_HEIGHT}
                aria-valuemax={composerMaxHeight}
                aria-valuenow={composerHeight}
                tabIndex={0}
                title="向上拖动可扩大输入框"
                onPointerDown={handleComposerResizeStart}
                onKeyDown={handleComposerResizeKeyDown}
              >
                <div
                  className={'composer-resize-grip' + (composerHeight > MIN_COMPOSER_HEIGHT ? ' is-active' : '')}
                />
              </div>
              <div className="vc-composer composer-glow">
                {/* 已选知识库文档标识：回答前就能看到本次会引用哪些文档 */}
                {activeConv && (activeConv.knowledgeDocIds?.length ?? 0) > 0 && (
                  <div className="vc-composer-kb">
                    <Tag
                      icon={<Icon icon={databaseIcon} width={13} style={{ paddingTop: 4 }} />}
                      color="processing"
                      closable
                      onClick={openKbDrawer}
                      onClose={(e) => {
                        e.preventDefault();
                        setSelectedDocIds([]);
                      }}
                      style={{ margin: 0, cursor: 'pointer' }}
                    >
                      已引用 {activeConv.knowledgeDocIds!.length} 篇知识库文档
                    </Tag>
                    <span className="vc-composer-kb__hint">本次回答将优先依据这些文档</span>
                  </div>
                )}
                <div className="vc-composer__input">
                  <Input.TextArea
                    ref={inputRef}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="输入消息，Enter 发送，Shift+Enter 换行"
                    rows={1}
                    bordered={false}
                    style={{
                      height: composerHeight,
                      minHeight: MIN_COMPOSER_HEIGHT,
                      background: 'transparent',
                      resize: 'none',
                      paddingRight: 56,
                      overflowY: 'auto',
                    }}
                  />
                  {/* 发送按钮内嵌在输入框右侧并垂直居中 */}
                  <Button
                    className="vc-composer__send"
                    type="primary"
                    shape="circle"
                    icon={<Icon icon={sendIcon} width={18} />}
                    onClick={() => handleSend()}
                    loading={sending}
                    disabled={!inputValue.trim()}
                  />
                </div>
                {/* 工具行 */}
                <div className="vc-composer__tools">
                  <Tooltip title="知识库（RAG）">
                    <button
                      className={
                        'vc-composer-tool' + ((activeConv?.knowledgeDocIds?.length ?? 0) > 0 ? ' is-on' : '')
                      }
                      onClick={openKbDrawer}
                    >
                      <Icon icon={databaseIcon} width={16} />
                    </button>
                  </Tooltip>
                  <Tooltip title="上下文自动压缩：历史超过阈值时摘要最早对话，摘要失败则丢弃最早历史">
                    <span
                      className={
                        'vc-composer-switch' + (activeConv?.compressEnabled !== false ? ' is-on' : '')
                      }
                    >
                      <Switch
                        size="small"
                        checked={activeConv?.compressEnabled !== false}
                        onChange={toggleCompress}
                      />
                      <span>压缩</span>
                    </span>
                  </Tooltip>
                  <Tooltip title="附件（demo）">
                    <button className="vc-composer-tool">
                      <Icon icon={paperclipIcon} width={16} />
                    </button>
                  </Tooltip>
                  <Tooltip title="联网搜索（demo）">
                    <button className="vc-composer-tool">
                      <Icon icon={globeIcon} width={16} />
                    </button>
                  </Tooltip>
                  <Tooltip title="语音输入（demo）">
                    <button className="vc-composer-tool">
                      <Icon icon={micIcon} width={16} />
                    </button>
                  </Tooltip>
                  {models.length > 0 && (
                    <Select
                      size="small"
                      variant="borderless"
                      className="composer-model-select vc-composer-model"
                      value={
                        activeConv?.vendor
                          ? modelId(activeConv.vendor, activeConv.modelCode!)
                          : currentModelId ?? undefined
                      }
                      placeholder="选择模型"
                      options={models.map((m) => ({
                        value: modelId(m.vendor, m.modelCode),
                        label: (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <ModelModalityIcons types={m.modalities} fallback={m.modelType} size={13} />
                            {m.modelName}（{m.vendor}）
                          </span>
                        ),
                      }))}
                      onChange={(id) => setCurrentModel(id)}
                      disabled={!!activeConv?.vendor || loadingModels}
                      popupMatchSelectWidth={false}
                    />
                  )}
                  {activeConv?.vendor && <span className="vc-composer-bound">已绑定模型</span>}
                </div>
              </div>
            </div>
          </>
        ) : (
          /* 空状态 */
          <div className="vc-chat-empty">
            <span className="vc-chat-empty__icon">
              <Icon icon={messageSquareIcon} width={32} />
            </span>
            <span className="vc-chat-empty__title">选择或创建一个对话</span>
            <Button type="primary" icon={<Icon icon={plusIcon} width={14} />} onClick={handleCreate}>
              新建对话
            </Button>
          </div>
        )}
      </div>

      {/* 知识库选择抽屉（RAG 召回范围） */}
      <Drawer
        title="选择知识库文档（RAG）"
        placement="right"
        width={360}
        open={kbDrawerOpen}
        onClose={() => setKbDrawerOpen(false)}
      >
        <div className="vc-hint" style={{ marginBottom: 'var(--space-md)' }}>
          已选 {activeConv?.knowledgeDocIds?.length ?? 0} 篇（仅已向量化文档可召回）
        </div>
        {kbLoading ? (
          <div className="vc-chat-list__loading">
            <Spin />
          </div>
        ) : kbDocs.length === 0 ? (
          <div className="vc-knowledge-list__empty">暂无文档</div>
        ) : (
          <Checkbox.Group
            style={{ width: '100%' }}
            value={activeConv?.knowledgeDocIds ?? []}
            onChange={(vals) => setSelectedDocIds(vals as number[])}
          >
            <div className="vc-kb-list">
              {kbDocs.map((doc) => (
                <div key={doc.id} className="vc-kb-card">
                  <Checkbox value={doc.id} disabled={!doc.isVectorized}>
                    <span className="vc-kb-card__title">{doc.title}</span>
                  </Checkbox>
                  <div className="vc-kb-card__meta">
                    {doc.isVectorized ? (
                      <Tag color="success" icon={<Icon icon={zapIcon} width={12} />} style={{ margin: 0 }}>
                        已向量化
                      </Tag>
                    ) : (
                      <Tag style={{ margin: 0 }}>未向量化</Tag>
                    )}
                    {doc.tags && doc.tags.length > 0 && (
                      <span className="vc-kb-card__tags">{doc.tags.slice(0, 3).join(' / ')}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Checkbox.Group>
        )}
      </Drawer>
    </div>
  );
};

export default ChatPage;
