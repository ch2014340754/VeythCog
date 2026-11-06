import React, { useState, useEffect, useCallback } from 'react';
import {
  Input,
  Button,
  Empty,
  Spin,
  Tag,
  Popconfirm,
  Modal,
  message,
  Segmented,
  Tooltip,
  Upload,
  Divider,
  Space,
} from 'antd';
import { Icon } from '@iconify/react';
import searchIcon from '@iconify-icons/lucide/search';
import plusIcon from '@iconify-icons/lucide/plus';
import trashIcon from '@iconify-icons/lucide/trash-2';
import bookOpenIcon from '@iconify-icons/lucide/book-open';
import fileTextIcon from '@iconify-icons/lucide/file-text';
import uploadIcon from '@iconify-icons/lucide/upload';
import downloadIcon from '@iconify-icons/lucide/download';
import saveIcon from '@iconify-icons/lucide/save';
import zapIcon from '@iconify-icons/lucide/zap';
import zapOffIcon from '@iconify-icons/lucide/zap-off';
import tagIcon from '@iconify-icons/lucide/tag';
import eyeIcon from '@iconify-icons/lucide/eye';
import eyeOffIcon from '@iconify-icons/lucide/eye-off';
import ReactMarkdown from 'react-markdown';
import CollapsibleSidebar from '@/components/CollapsibleSidebar';
import {
  listDocs,
  getDoc,
  createDoc,
  updateDoc,
  deleteDoc,
  importMd,
  exportMd,
  vectorize,
  unvectorize,
} from '@/api/knowledge';
import type { DocListItem, DocDetail, LibType } from '@/types';
import { formatRelativeTime } from '@/utils/formatTime';
import { useTheme } from '@/contexts/ThemeContext';

const SIDEBAR_WIDTH = 280;

const KnowledgePage: React.FC = () => {
  const { colors } = useTheme();
  const [libType, setLibType] = useState<LibType>('private');
  const [docs, setDocs] = useState<DocListItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeDocId, setActiveDocId] = useState<number | null>(null);

  const [detail, setDetail] = useState<DocDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [markdownText, setMarkdownText] = useState('');
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [vectorizing, setVectorizing] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const isDemo = libType === 'demo';

  const loadDocs = useCallback(async () => {
    setLoading(true);
    try {
      const page = await listDocs({ libType, keyword: keyword.trim() || undefined, current: 1, pageSize: 100 });
      setDocs(page.records ?? []);
      setTotal(page.total ?? 0);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载文档失败');
    } finally {
      setLoading(false);
    }
  }, [libType, keyword]);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  useEffect(() => {
    setActiveDocId(null);
    setDetail(null);
  }, [libType]);

  const selectDoc = async (id: number) => {
    setActiveDocId(id);
    setDetailLoading(true);
    try {
      const d = await getDoc(id);
      setDetail(d);
      setTitle(d.title ?? '');
      setSummary(d.summary ?? '');
      setTagsText((d.tags ?? []).join(', '));
      setMarkdownText(d.markdownText ?? '');
      setPreview(false);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载文档详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      message.warning('标题不能为空');
      return;
    }
    const tags = tagsText
      .split(/[,，]/)
      .map((t) => t.trim())
      .filter(Boolean);
    const payload = {
      libType,
      title: title.trim(),
      summary: summary.trim(),
      tags,
      blockData: '[]',
      markdownText,
    };
    setSaving(true);
    try {
      if (detail) {
        await updateDoc(detail.id, payload);
        message.success('已保存（内容变更后需重新向量化）');
        await selectDoc(detail.id);
      } else {
        const id = await createDoc(payload);
        message.success('已创建');
        setCreateOpen(false);
        setNewTitle('');
        await loadDocs();
        await selectDoc(id);
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setTitle(newTitle.trim());
    setSummary('');
    setTagsText('');
    setMarkdownText('');
    setDetail(null);
    setActiveDocId(null);
    await handleSave();
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteDoc(id);
      message.success('已删除');
      if (activeDocId === id) {
        setActiveDocId(null);
        setDetail(null);
      }
      await loadDocs();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '删除失败');
    }
  };

  const handleVectorize = async () => {
    if (!detail) return;
    setVectorizing(true);
    try {
      const count = await vectorize(detail.id);
      message.success(`已向量化，共 ${count} 个分片`);
      await selectDoc(detail.id);
      await loadDocs();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '向量化失败');
    } finally {
      setVectorizing(false);
    }
  };

  const handleUnvectorize = async () => {
    if (!detail) return;
    setVectorizing(true);
    try {
      await unvectorize(detail.id);
      message.success('已取消向量化');
      await selectDoc(detail.id);
      await loadDocs();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '取消向量化失败');
    } finally {
      setVectorizing(false);
    }
  };

  const handleExport = async () => {
    if (!detail) return;
    try {
      await exportMd(detail.id);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '导出失败');
    }
  };

  const handleImport = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.md')) {
      message.error('仅支持 .md 文件');
      return;
    }
    if (file.size > 500 * 1024) {
      message.error('文件超过 500KB');
      return;
    }
    try {
      const id = await importMd(file, libType, file.name.replace(/\.md$/i, ''));
      message.success('已导入');
      await loadDocs();
      await selectDoc(id);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '导入失败');
    }
  };

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <CollapsibleSidebar width={SIDEBAR_WIDTH}>
        <div style={{ padding: '16px 12px 8px' }}>
          <Segmented
            block
            value={libType}
            onChange={(v) => setLibType(v as LibType)}
            options={[
              { label: '私有库', value: 'private' },
              { label: '演示库', value: 'demo' },
            ]}
          />
        </div>

        <div style={{ padding: '0 12px 8px' }}>
          <Input
            prefix={<Icon icon={searchIcon} width={14} style={{ color: colors.textTertiary }} />}
            placeholder="搜索文档..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            allowClear
            style={{ borderRadius: 'var(--radius-md)' }}
          />
        </div>

        {!isDemo && (
          <div style={{ padding: '0 12px 8px', display: 'flex', gap: 8 }}>
            <Button
              icon={<Icon icon={plusIcon} width={14} />}
              onClick={() => setCreateOpen(true)}
              block
              type="primary"
              style={{ borderRadius: 'var(--radius-md)' }}
            >
              新建
            </Button>
            <Upload
              showUploadList={false}
              accept=".md"
              beforeUpload={(file) => {
                void handleImport(file as File);
                return false;
              }}
            >
              <Button icon={<Icon icon={uploadIcon} width={14} />} style={{ borderRadius: 'var(--radius-md)' }}>
                导入
              </Button>
            </Upload>
          </div>
        )}

        <div style={{ padding: '0 12px 6px', fontSize: 11, color: colors.textTertiary }}>
          {isDemo ? '演示库只读' : `共 ${total} 篇文档`}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <Spin />
            </div>
          ) : docs.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无文档" style={{ marginTop: 40 }} />
          ) : (
            docs.map((doc) => {
              const isActive = doc.id === activeDocId;
              return (
                <div
                  key={doc.id}
                  onClick={() => selectDoc(doc.id)}
                  style={{
                    padding: '12px',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    background: isActive ? colors.primary10 : 'transparent',
                    border: isActive ? `1px solid ${colors.primary30}` : '1px solid transparent',
                    marginBottom: 2,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icon icon={fileTextIcon} width={14} style={{ color: colors.primary, flexShrink: 0 }} />
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
                      {doc.title}
                    </span>
                    {doc.isVectorized && (
                      <Icon icon={zapIcon} width={12} style={{ color: colors.success, flexShrink: 0 }} />
                    )}
                  </div>
                  {doc.tags && doc.tags.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6, paddingLeft: 22 }}>
                      {doc.tags.slice(0, 3).map((t) => (
                        <Tag key={t} style={{ margin: 0, fontSize: 10, lineHeight: '18px' }}>
                          {t}
                        </Tag>
                      ))}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: colors.textTertiary, marginTop: 4, paddingLeft: 22 }}>
                    {formatRelativeTime(doc.updatedAt)}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CollapsibleSidebar>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {!detail ? (
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
            <Icon icon={bookOpenIcon} width={64} style={{ color: colors.textTertiary, opacity: 0.3 }} />
            <span style={{ color: colors.textTertiary, fontSize: 16 }}>选择或新建一个文档</span>
            {!isDemo && (
              <Space>
                <Button type="primary" icon={<Icon icon={plusIcon} width={14} />} onClick={() => setCreateOpen(true)}>
                  新建文档
                </Button>
                <Upload
                  showUploadList={false}
                  accept=".md"
                  beforeUpload={(file) => {
                    void handleImport(file as File);
                    return false;
                  }}
                >
                  <Button icon={<Icon icon={uploadIcon} width={14} />}>导入 Markdown</Button>
                </Upload>
              </Space>
            )}
          </div>
        ) : detailLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <Spin />
          </div>
        ) : (
          <>
            <div
              style={{
                padding: '12px 24px',
                borderBottom: `1px solid ${colors.divider}`,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isDemo}
                placeholder="文档标题"
                style={{ flex: 1, minWidth: 200, fontWeight: 600, borderRadius: 'var(--radius-md)' }}
              />
              <Tag color={isDemo ? 'orange' : 'blue'} style={{ margin: 0 }}>
                {isDemo ? '演示库' : '私有库'}
              </Tag>
              {detail.isVectorized ? (
                <Tag color="success" icon={<Icon icon={zapIcon} width={12} />} style={{ margin: 0 }}>
                  已向量化
                </Tag>
              ) : (
                <Tag color="default" style={{ margin: 0 }}>未向量化</Tag>
              )}
              <Space size={4}>
                {!isDemo && (
                  <>
                    <Tooltip title="保存">
                      <Button icon={<Icon icon={saveIcon} width={14} />} onClick={handleSave} loading={saving} />
                    </Tooltip>
                    {detail.isVectorized ? (
                      <Tooltip title="取消向量化">
                        <Button icon={<Icon icon={zapOffIcon} width={14} />} onClick={handleUnvectorize} loading={vectorizing} />
                      </Tooltip>
                    ) : (
                      <Tooltip title="向量化">
                        <Button
                          type="primary"
                          icon={<Icon icon={zapIcon} width={14} />}
                          onClick={handleVectorize}
                          loading={vectorizing}
                        >
                          向量化
                        </Button>
                      </Tooltip>
                    )}
                    <Tooltip title="导出 Markdown">
                      <Button icon={<Icon icon={downloadIcon} width={14} />} onClick={handleExport} />
                    </Tooltip>
                    <Popconfirm title="确定删除该文档？" onConfirm={() => handleDelete(detail.id)} okText="删除" cancelText="取消">
                      <Tooltip title="删除">
                        <Button danger icon={<Icon icon={trashIcon} width={14} />} />
                      </Tooltip>
                    </Popconfirm>
                  </>
                )}
              </Space>
            </div>

            <div style={{ padding: '12px 24px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Input
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                disabled={isDemo}
                placeholder="摘要（可选）"
                style={{ borderRadius: 'var(--radius-md)' }}
              />
              <Input
                value={tagsText}
                onChange={(e) => setTagsText(e.target.value)}
                disabled={isDemo}
                prefix={<Icon icon={tagIcon} width={14} style={{ color: colors.textTertiary }} />}
                placeholder="标签（逗号分隔）"
                style={{ borderRadius: 'var(--radius-md)' }}
              />
            </div>

            <Divider style={{ margin: '12px 0 0' }} />

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '0 24px 8px', display: 'flex', justifyContent: 'flex-end' }}>
                <Segmented
                  size="small"
                  value={preview ? 'preview' : 'edit'}
                  onChange={(v) => setPreview(v === 'preview')}
                  options={[
                    { label: '编辑', value: 'edit', icon: <Icon icon={eyeOffIcon} width={12} /> },
                    { label: '预览', value: 'preview', icon: <Icon icon={eyeIcon} width={12} /> },
                  ]}
                />
              </div>
              <div style={{ flex: 1, overflow: 'auto', padding: '0 24px 24px' }}>
                {preview ? (
                  <div className="md-body" style={{ minHeight: 200 }}>
                    <ReactMarkdown>{markdownText || '*暂无内容*'}</ReactMarkdown>
                  </div>
                ) : (
                  <Input.TextArea
                    value={markdownText}
                    onChange={(e) => setMarkdownText(e.target.value)}
                    disabled={isDemo}
                    placeholder="在此输入 Markdown 内容..."
                    autoSize={{ minRows: 12 }}
                    style={{
                      borderRadius: 'var(--radius-md)',
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                      fontSize: 13,
                      lineHeight: 1.7,
                    }}
                  />
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <Modal
        title="新建文档"
        open={createOpen}
        onOk={handleCreate}
        onCancel={() => {
          setCreateOpen(false);
          setNewTitle('');
        }}
        okText="创建"
        cancelText="取消"
        okButtonProps={{ disabled: !newTitle.trim() }}
        confirmLoading={saving}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
          <Input
            placeholder="文档标题"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onPressEnter={handleCreate}
            style={{ borderRadius: 'var(--radius-md)' }}
          />
          <div style={{ fontSize: 12, color: colors.textTertiary }}>
            创建后可在编辑器中继续填写内容、标签与摘要。
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default KnowledgePage;