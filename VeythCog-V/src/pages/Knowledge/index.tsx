import React, { useState, useEffect } from 'react';
import { Input, Button, Empty, Spin, Tag, Popconfirm, Modal, Card, Row, Col, message } from 'antd';
import { Icon } from '@iconify/react';
import searchIcon from '@iconify-icons/lucide/search';
import plusIcon from '@iconify-icons/lucide/plus';
import trashIcon from '@iconify-icons/lucide/trash-2';
import bookOpenIcon from '@iconify-icons/lucide/book-open';
import fileTextIcon from '@iconify-icons/lucide/file-text';
import fileTypeIcon from '@iconify-icons/lucide/file-type';
import hashIcon from '@iconify-icons/lucide/hash';
import hardDriveIcon from '@iconify-icons/lucide/hard-drive';
import fileIcon from '@iconify-icons/lucide/file';
import tableIcon from '@iconify-icons/lucide/table';
import uploadIcon from '@iconify-icons/lucide/upload';
import {
  getKnowledgeBases,
  getKnowledgeBase,
  createKnowledgeBase,
  deleteKnowledgeBase,
} from '@/api/knowledge';
import type { KnowledgeBase, KnowledgeDocument, DocumentStatus } from '@/types';
import CollapsibleSidebar from '@/components/CollapsibleSidebar';
import { formatRelativeTime } from '@/utils/formatTime';
import { useTheme } from '@/contexts/ThemeContext';

/** 侧栏宽度（与 Chat 页保持一致） */
const SIDEBAR_WIDTH = 280;

/** 文档类型图标映射 */
const docTypeIcons: Record<string, typeof fileIcon> = {
  pdf: fileTextIcon,
  docx: fileTypeIcon,
  md: fileTextIcon,
  txt: fileIcon,
  csv: tableIcon,
};

/** 文档状态 Tag 颜色 */
const statusConfig: Record<DocumentStatus, { color: string; label: string }> = {
  completed: { color: 'success', label: '已完成' },
  processing: { color: 'processing', label: '处理中' },
  pending: { color: 'default', label: '等待中' },
  failed: { color: 'error', label: '失败' },
};

const KnowledgePage: React.FC = () => {
  const { colors } = useTheme();
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [activeKbId, setActiveKbId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newKbName, setNewKbName] = useState('');
  const [newKbDesc, setNewKbDesc] = useState('');

  // 当前活跃知识库
  const activeKb = knowledgeBases.find((kb) => kb.id === activeKbId) || null;

  // 加载知识库列表
  useEffect(() => {
    loadKnowledgeBases();
  }, []);

  const loadKnowledgeBases = async () => {
    setLoading(true);
    const data = await getKnowledgeBases();
    setKnowledgeBases(data);
    if (data.length > 0 && !activeKbId) {
      setActiveKbId(data[0].id);
    }
    setLoading(false);
  };

  // 搜索过滤
  const filteredKbs = knowledgeBases.filter(
    (kb) =>
      kb.name.toLowerCase().includes(searchText.toLowerCase()) ||
      kb.description.toLowerCase().includes(searchText.toLowerCase())
  );

  // 创建知识库
  const handleCreate = async () => {
    if (!newKbName.trim()) return;
    const newKb = await createKnowledgeBase(newKbName.trim(), newKbDesc.trim());
    setKnowledgeBases((prev) => [newKb, ...prev]);
    setActiveKbId(newKb.id);
    setCreateModalOpen(false);
    setNewKbName('');
    setNewKbDesc('');
  };

  // 删除知识库
  const handleDelete = async (id: string) => {
    await deleteKnowledgeBase(id);
    setKnowledgeBases((prev) => prev.filter((kb) => kb.id !== id));
    if (activeKbId === id) {
      const remaining = knowledgeBases.filter((kb) => kb.id !== id);
      setActiveKbId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* 左侧面板 - 知识库列表（可折叠） */}
      <CollapsibleSidebar width={SIDEBAR_WIDTH}>
        {/* 搜索框 */}
        <div style={{ padding: '16px 12px 8px' }}>
          <Input
            prefix={<Icon icon={searchIcon} width={14} style={{ color: colors.textTertiary }} />}
            placeholder="搜索知识库..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
            style={{ borderRadius: 'var(--radius-md)' }}
          />
        </div>

        {/* 新建知识库按钮 */}
        <div style={{ padding: '0 12px 8px' }}>
          <Button
            icon={<Icon icon={plusIcon} width={14} />}
            onClick={() => setCreateModalOpen(true)}
            block
            type="primary"
            style={{ borderRadius: 'var(--radius-md)' }}
          >
            新建知识库
          </Button>
        </div>

        {/* 知识库列表 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <Spin />
            </div>
          ) : filteredKbs.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="暂无知识库"
              style={{ marginTop: 40 }}
            />
          ) : (
            filteredKbs.map((kb) => {
              const isActive = kb.id === activeKbId;
              return (
                <div
                  key={kb.id}
                  onClick={() => setActiveKbId(kb.id)}
                  style={{
                    padding: '12px',
                    marginBottom: 4,
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    background: isActive
                      ? colors.primary10
                      : 'transparent',
                    border: isActive
                      ? `1px solid ${colors.primary30}`
                      : '1px solid transparent',
                    transition: `all 0.15s var(--spring)`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    {/* 封面色块 */}
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 'var(--radius-md)',
                        background: kb.coverColor,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Icon icon={bookOpenIcon} width={16} style={{ color: '#fff' }} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* 名称 */}
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          color: isActive ? colors.primary : colors.text,
                        }}
                      >
                        {kb.name}
                      </div>
                      {/* 描述 */}
                      <div
                        style={{
                          fontSize: 11,
                          color: colors.textTertiary,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          marginTop: 2,
                        }}
                      >
                        {kb.description}
                      </div>
                      {/* 文档数和创建时间 */}
                      <div
                        style={{
                          fontSize: 11,
                          color: colors.textTertiary,
                          marginTop: 4,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Icon icon={fileIcon} width={11} />
                          {kb.documentCount} 个文档
                        </span>
                        <span style={{ opacity: 0.7 }}>{formatRelativeTime(kb.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CollapsibleSidebar>

      {/* 右侧详情 */}
      <div
        style={{
          flex: 1,
          height: '100%',
          overflowY: 'auto',
          padding: 24,
        }}
      >
        {activeKb ? (
          <>
            {/* 知识库标题和描述 */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 'var(--radius-md)',
                      background: activeKb.coverColor,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon icon={bookOpenIcon} width={16} style={{ color: '#fff' }} />
                  </div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{activeKb.name}</h2>
                </div>
                <p style={{ fontSize: 14, color: colors.textSecondary, margin: 0 }}>
                  {activeKb.description}
                </p>
              </div>
              <Popconfirm
                title="确认删除"
                description="删除后不可恢复，确认删除此知识库？"
                onConfirm={() => handleDelete(activeKb.id)}
                okText="确认"
                cancelText="取消"
              >
                <Button
                  danger
                  icon={<Icon icon={trashIcon} width={14} />}
                  size="small"
                  style={{ borderRadius: 'var(--radius-md)' }}
                >
                  删除
                </Button>
              </Popconfirm>
            </div>

            {/* 统计卡片 */}
            <Row gutter={16} style={{ marginBottom: 24 }}>
              <Col span={8}>
                <Card
                  size="small"
                  style={{ borderRadius: 'var(--radius-lg)', textAlign: 'center' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 4 }}>
                    <Icon icon={fileIcon} width={16} style={{ color: colors.primary }} />
                    <span style={{ fontSize: 12, color: colors.textSecondary }}>文档数</span>
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: colors.primary }}>
                    {activeKb.documentCount}
                  </div>
                </Card>
              </Col>
              <Col span={8}>
                <Card
                  size="small"
                  style={{ borderRadius: 'var(--radius-lg)', textAlign: 'center' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 4 }}>
                    <Icon icon={hashIcon} width={16} style={{ color: colors.primary }} />
                    <span style={{ fontSize: 12, color: colors.textSecondary }}>分段数</span>
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: colors.primary }}>
                    {activeKb.segmentCount}
                  </div>
                </Card>
              </Col>
              <Col span={8}>
                <Card
                  size="small"
                  style={{ borderRadius: 'var(--radius-lg)', textAlign: 'center' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 4 }}>
                    <Icon icon={hardDriveIcon} width={16} style={{ color: colors.primary }} />
                    <span style={{ fontSize: 12, color: colors.textSecondary }}>总大小</span>
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: colors.primary }}>
                    {activeKb.totalSize}
                  </div>
                </Card>
              </Col>
            </Row>

            {/* 文档列表 */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>文档列表</h3>
                <Button
                  size="small"
                  type="primary"
                  icon={<Icon icon={uploadIcon} width={14} />}
                  onClick={() => message.info('上传文档功能开发中（demo）')}
                >
                  上传文档
                </Button>
              </div>
              {activeKb.documents.length === 0 ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="暂无文档"
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {activeKb.documents.map((doc) => {
                    const statusInfo = statusConfig[doc.status] || statusConfig.pending;
                    return (
                      <div
                        key={doc.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '12px 16px',
                          borderRadius: 'var(--radius-md)',
                          background: colors.surface,
                          border: `1px solid ${colors.divider}`,
                          gap: 12,
                        }}
                      >
                        {/* 文件类型图标 */}
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 'var(--radius-md)',
                            background: colors.primary10,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <Icon
                            icon={docTypeIcons[doc.type] || fileIcon}
                            width={18}
                            style={{ color: colors.primary }}
                          />
                        </div>

                        {/* 文件信息 */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 500,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {doc.name}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: colors.textTertiary,
                              marginTop: 2,
                            }}
                          >
                            {doc.type.toUpperCase()} · {doc.size}
                            {doc.segmentCount > 0 && ` · ${doc.segmentCount} 段`}
                            <span style={{ marginLeft: 6, opacity: 0.7 }}>{formatRelativeTime(doc.createdAt)}</span>
                          </div>
                        </div>

                        {/* 处理状态 */}
                        <Tag
                          color={statusInfo.color}
                          style={{ margin: 0, borderRadius: 'var(--radius-full)' }}
                        >
                          {statusInfo.label}
                        </Tag>
                      </div>
                    );
                  })}
                </div>
              )}
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
              icon={bookOpenIcon}
              width={64}
              style={{ color: colors.textTertiary, opacity: 0.3 }}
            />
            <span style={{ color: colors.textTertiary, fontSize: 16 }}>
              选择或创建一个知识库
            </span>
            <Button
              type="primary"
              icon={<Icon icon={plusIcon} width={14} />}
              onClick={() => setCreateModalOpen(true)}
            >
              新建知识库
            </Button>
          </div>
        )}
      </div>

      {/* 创建知识库弹窗 */}
      <Modal
        title="新建知识库"
        open={createModalOpen}
        onOk={handleCreate}
        onCancel={() => {
          setCreateModalOpen(false);
          setNewKbName('');
          setNewKbDesc('');
        }}
        okText="创建"
        cancelText="取消"
        okButtonProps={{ disabled: !newKbName.trim() }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 }}>
          <Input
            placeholder="知识库名称"
            value={newKbName}
            onChange={(e) => setNewKbName(e.target.value)}
            style={{ borderRadius: 'var(--radius-md)' }}
          />
          <Input.TextArea
            placeholder="知识库描述（可选）"
            value={newKbDesc}
            onChange={(e) => setNewKbDesc(e.target.value)}
            autoSize={{ minRows: 2, maxRows: 4 }}
            style={{ borderRadius: 'var(--radius-md)' }}
          />
        </div>
      </Modal>
    </div>
  );
};

export default KnowledgePage;