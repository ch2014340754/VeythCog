import {
    createDoc,
    deleteDoc,
    exportMd,
    getDoc,
    importMd,
    listDocs,
    regenerateMetadata,
    unvectorize,
    updateDoc,
    vectorize,
} from '@/api/knowledge';
import CollapsibleSidebar from '@/components/CollapsibleSidebar';
import { useTheme } from '@/contexts/ThemeContext';
import type { DocDetail, DocListItem } from '@/types';
import { formatRelativeTime } from '@/utils/formatTime';
import alignLeftIcon from '@iconify-icons/lucide/align-left';
import bookOpenIcon from '@iconify-icons/lucide/book-open';
import downloadIcon from '@iconify-icons/lucide/download';
import fileTextIcon from '@iconify-icons/lucide/file-text';
import plusIcon from '@iconify-icons/lucide/plus';
import saveIcon from '@iconify-icons/lucide/save';
import searchIcon from '@iconify-icons/lucide/search';
import sparklesIcon from '@iconify-icons/lucide/sparkles';
import trashIcon from '@iconify-icons/lucide/trash-2';
import uploadIcon from '@iconify-icons/lucide/upload';
import zapIcon from '@iconify-icons/lucide/zap';
import zapOffIcon from '@iconify-icons/lucide/zap-off';
import { Icon } from '@iconify/react';
import {
    Button,
    Empty,
    Input,
    message,
    Modal,
    Popconfirm,
    Space,
    Spin,
    Tag,
    Tooltip,
    Upload,
} from 'antd';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import DocEditor, { type DocEditorHandle } from './DocEditor';

const SIDEBAR_WIDTH = 280;

/** 切换文档时的顶部细进度条：不遮挡内容，仅在右上角提示加载中 */
const SlimProgress: React.FC = () => (
  <div
    aria-hidden
    style={{
      position: 'absolute',
      top: 0,
      right: 0,
      width: 120,
      height: 3,
      overflow: 'hidden',
      pointerEvents: 'none',
      zIndex: 10,
      borderBottomLeftRadius: 3,
    }}
  >
    <div
      style={{
        width: '45%',
        height: '100%',
        borderRadius: 3,
        background: 'var(--color-primary, #7C3AED)',
        animation: 'vc-slim-progress 1.1s ease-in-out infinite',
      }}
    />
  </div>
);

const KnowledgePage: React.FC = () => {
  const { colors } = useTheme();
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
  const [saving, setSaving] = useState(false);
  const [vectorizing, setVectorizing] = useState(false);
  const [metaGenerating, setMetaGenerating] = useState(false);
  /** 元数据弹窗：摘要 + 标签统一编辑 */
  const [metaOpen, setMetaOpen] = useState(false);
  const [metaSummary, setMetaSummary] = useState('');
  const [metaTags, setMetaTags] = useState('');
  const editorRef = useRef<DocEditorHandle>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  /**
   * 拉取文档列表。
   * @param opts.silent 静默刷新：不切换 loading（侧栏不闪 Spin），仅在原列表上原地更新，
   *                    用于保存 / 向量化 / 删除后的数据同步
   */
  const loadDocs = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    if (!silent) setLoading(true);
    try {
      const page = await listDocs({ keyword: keyword.trim() || undefined, current: 1, pageSize: 100 });
      setDocs(page.records ?? []);
      setTotal(page.total ?? 0);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载文档失败');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [keyword]);

  /** 静默同步列表（不闪加载态） */
  const refreshDocsSilently = useCallback(() => loadDocs({ silent: true }), [loadDocs]);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  /**
   * 打开文档。
   * @param opts.silent 静默加载：不切换 detailLoading（编辑区不闪 Spin），
   *                    用于保存 / 向量化后需要刷新详情但不想打断编辑器的场景
   */
  const selectDoc = async (id: number, opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    // 重复点击当前已打开的文档时直接返回，避免无意义的重新拉取与 loading 闪烁
    if (!silent && id === activeDocId && detail?.id === id) return;
    if (!silent) {
      setActiveDocId(id);
      setDetailLoading(true);
    }
    try {
      const d = await getDoc(id);
      setDetail(d);
      setTitle(d.title ?? '');
      setSummary(d.summary ?? '');
      setTagsText((d.tags ?? []).join(', '));
      if (silent) setActiveDocId(id);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载文档详情失败');
    } finally {
      if (!silent) setDetailLoading(false);
    }
  };

  /**
   * 保存文档（标题 / 摘要 / 标签 / 正文）。
   * @param override 元数据弹窗提交时的草稿值，避免 setState 异步导致取到旧值
   * @returns 是否保存成功（供元数据弹窗决定是否关闭）
   */
  const handleSave = async (override?: { summary?: string; tagsText?: string }): Promise<boolean> => {
    if (!detail) return false;
    const summaryValue = (override?.summary ?? summary).trim();
    const rawTags = override?.tagsText ?? tagsText;
    const tags = rawTags
      .split(/[,，]/)
      .map((t) => t.trim())
      .filter(Boolean);
    // 编辑态从块编辑器拉取最新内容（blockData 权威源 + markdown 派生缓存）
    const snap = await editorRef.current?.snapshot();
    const payload = {
      title: title.trim() || '未命名文档',
      summary: summaryValue,
      tags,
      blockData: snap?.blockData ?? '[]',
      markdownText: snap?.markdownText ?? '',
    };
    setSaving(true);
    try {
      await updateDoc(detail.id, payload);
      // 本地乐观更新：只改元信息，不重新拉详情（重拉会让 DocEditor 重解析 blockData 造成闪动）
      setDetail((prev) =>
        prev ? { ...prev, title: payload.title, summary: payload.summary, tags, isVectorized: false } : prev
      );
      setDocs((prev) =>
        prev.map((d) =>
          d.id === detail.id
            ? { ...d, title: payload.title, summary: payload.summary, tags, isVectorized: false }
            : d
        )
      );
      setTitle(payload.title);
      setSummary(summaryValue);
      setTagsText(tags.join(', '));
      message.success('已保存（内容变更后需重新向量化）');
      void refreshDocsSilently();
      return true;
    } catch (e) {
      message.error(e instanceof Error ? e.message : '保存失败');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    const docTitle = newTitle.trim();
    const payload = {
      title: docTitle,
      summary: '',
      tags: [] as string[],
      blockData: '[]',
      // 种子：首个 H1 即文档标题，顶部标题与正文同步
      markdownText: `# ${docTitle}\n`,
    };
    setSaving(true);
    try {
      const id = await createDoc(payload);
      message.success('已创建');
      setCreateOpen(false);
      setNewTitle('');
      await loadDocs({ silent: true });
      await selectDoc(id);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '创建失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteDoc(id);
      message.success('已删除');
      if (activeDocId === id) {
        setActiveDocId(null);
        setDetail(null);
      }
      await loadDocs({ silent: true });
    } catch (e) {
      message.error(e instanceof Error ? e.message : '删除失败');
    }
  };

  /** 应用后端生成的元数据：只改摘要/标签等元信息，不碰 blockData，避免编辑器重解析 */
  const applyGeneratedMetadata = (
    docId: number,
    nextSummary?: string | null,
    nextTags?: string[] | null
  ) => {
    const hasSummary = !!nextSummary;
    const hasTags = !!nextTags && nextTags.length > 0;
    if (!hasSummary && !hasTags) return;
    if (hasSummary) {
      setSummary(nextSummary as string);
    }
    if (hasTags) {
      setTagsText((nextTags as string[]).join(', '));
    }
    setDetail((prev) =>
      prev
        ? {
            ...prev,
            summary: hasSummary ? (nextSummary as string) : prev.summary,
            tags: hasTags ? (nextTags as string[]) : prev.tags,
          }
        : prev
    );
    setDocs((prev) =>
      prev.map((d) =>
        d.id === docId
          ? {
              ...d,
              summary: hasSummary ? (nextSummary as string) : d.summary,
              tags: hasTags ? (nextTags as string[]) : d.tags,
            }
          : d
      )
    );
  };

  const handleRegenerateMetadata = async () => {
    if (!detail) return;
    setMetaGenerating(true);
    try {
      const meta = await regenerateMetadata(detail.id);
      applyGeneratedMetadata(detail.id, meta.summary, meta.tags);
      message.success('已重新生成摘要与标签');
    } catch (e) {
      message.error(e instanceof Error ? e.message : '生成失败');
    } finally {
      setMetaGenerating(false);
    }
  };

  const handleVectorize = async () => {
    if (!detail) return;
    setVectorizing(true);
    try {
      const result = await vectorize(detail.id);
      message.success(`已向量化，共 ${result.chunkCount} 个分片`);
      // 原地更新标记，不重拉详情（重拉会重解析编辑器内容造成闪动）
      setDetail((prev) => (prev ? { ...prev, isVectorized: true } : prev));
      setDocs((prev) => prev.map((d) => (d.id === detail.id ? { ...d, isVectorized: true } : d)));
      // 后端已按"仅填空值"补齐摘要/标签，这里直接应用，避免额外拉详情
      applyGeneratedMetadata(detail.id, result.summary, result.tags);
      void refreshDocsSilently();
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
      setDetail((prev) => (prev ? { ...prev, isVectorized: false } : prev));
      setDocs((prev) => prev.map((d) => (d.id === detail.id ? { ...d, isVectorized: false } : d)));
      void refreshDocsSilently();
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
      const id = await importMd(file, file.name.replace(/\.md$/i, ''));
      message.success('已导入');
      await loadDocs({ silent: true });
      await selectDoc(id);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '导入失败');
    }
  };

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <CollapsibleSidebar width={SIDEBAR_WIDTH}>
        <div style={{ padding: '15px 12px 8px' }}>
          <Input
            prefix={<Icon icon={searchIcon} width={14} style={{ color: colors.textTertiary }} />}
            placeholder="搜索文档..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            allowClear
            style={{ borderRadius: 'var(--radius-md)' }}
          />
        </div>

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

        <div style={{ padding: '0 12px 6px', fontSize: 11, color: colors.textTertiary }}>
          共 {total} 篇文档
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
          </div>
        ) : (
          <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
            {/* 切换文档时保留上一篇内容，只在右上角显示细进度条 */}
            {detailLoading && <SlimProgress />}
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
              <button
                type="button"
                onClick={() => editorRef.current?.focusTitle()}
                title="文档标题（与正文首个 # 标题同步，点击定位）"
                style={{
                  flex: 1,
                  minWidth: 200,
                  textAlign: 'left',
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  fontSize: 18,
                  fontWeight: 600,
                  lineHeight: 1.4,
                  color: colors.text,
                  cursor: 'text',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {title || '未命名文档'}
              </button>
              {detail.isVectorized ? (
                <Tag color="success" icon={<Icon icon={zapIcon} width={12} />} style={{ margin: 0 }}>
                  已向量化
                </Tag>
              ) : (
                <Tag color="default" style={{ margin: 0 }}>未向量化</Tag>
              )}
              <Space size={4}>
                <>
                    <Popconfirm
                      title={
                        summary || tagsText.trim()
                          ? 'AI 将覆盖现有摘要与标签，确定重新生成？'
                          : '用 AI 生成摘要与标签？'
                      }
                      onConfirm={handleRegenerateMetadata}
                      okText="生成"
                      cancelText="取消"
                    >
                      <Tooltip title="AI 重新生成摘要与标签">
                        <Button
                          type="text"
                          icon={<Icon icon={sparklesIcon} width={14} />}
                          loading={metaGenerating}
                          disabled={detailLoading}
                        />
                      </Tooltip>
                    </Popconfirm>
                    <Tooltip title="编辑元数据（摘要 / 标签）">
                      <Button
                        icon={<Icon icon={alignLeftIcon} width={14} />}
                        onClick={() => {
                          setMetaSummary(summary);
                          setMetaTags(tagsText);
                          setMetaOpen(true);
                        }}
                        type={summary || tagsText ? 'default' : 'text'}
                        disabled={detailLoading}
                      />
                    </Tooltip>
                    <Tooltip  title="保存">
                      <Button type="primary" icon={<Icon icon={saveIcon} width={14} />} onClick={() => { void handleSave(); }} loading={saving} disabled={detailLoading} >
                      保存
                      </Button>
                    </Tooltip>
                    {detail.isVectorized ? (
                      <Tooltip title="取消向量化">
                        <Button icon={<Icon icon={zapOffIcon} width={14} />} onClick={handleUnvectorize} loading={vectorizing} disabled={detailLoading} />
                      </Tooltip>
                    ) : (
                      <Tooltip title="向量化">
                        <Button
                          type="primary"
                          icon={<Icon icon={zapIcon} width={14} />}
                          onClick={handleVectorize}
                          loading={vectorizing}
                          disabled={detailLoading}
                        >
                          向量化
                        </Button>
                      </Tooltip>
                    )}
                    <Tooltip title="导出 Markdown">
                      <Button icon={<Icon icon={downloadIcon} width={14} />} onClick={handleExport} disabled={detailLoading} />
                    </Tooltip>
                    <Popconfirm title="确定删除该文档？" onConfirm={() => handleDelete(detail.id)} okText="删除" cancelText="取消">
                      <Tooltip title="删除">
                        <Button danger icon={<Icon icon={trashIcon} width={14} />} disabled={detailLoading} />
                      </Tooltip>
                    </Popconfirm>
                </>
              </Space>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
              <DocEditor
                key={detail.id}
                ref={editorRef}
                docId={detail.id}
                blockData={detail.blockData ?? '[]'}
                markdownText={detail.markdownText ?? ''}
                onTitleChange={setTitle}
              />
            </div>
          </div>
        )}
      </div>

      <Modal
        title="编辑元数据"
        open={metaOpen}
        onOk={async () => {
          const ok = await handleSave({ summary: metaSummary, tagsText: metaTags });
          if (ok) setMetaOpen(false);
        }}
        onCancel={() => setMetaOpen(false)}
        okText="保存"
        cancelText="取消"
        confirmLoading={saving}
        width={520}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>摘要</div>
            <Input.TextArea
              value={metaSummary}
              onChange={(e) => setMetaSummary(e.target.value)}
              placeholder="一句话概括文档内容（用于列表页展示）"
              autoSize={{ minRows: 3, maxRows: 8 }}
              maxLength={500}
              showCount
              style={{ borderRadius: 'var(--radius-md)' }}
            />
            <div style={{ marginTop: 4, fontSize: 12, color: colors.textTertiary }}>
              向量化时会按「仅填空值」自动补齐；也可点工具栏的 AI 按钮重新生成。
            </div>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>标签</div>
            <Input
              value={metaTags}
              onChange={(e) => setMetaTags(e.target.value)}
              placeholder="逗号分隔，如：后端, 向量检索"
              style={{ borderRadius: 'var(--radius-md)' }}
            />
            <div style={{ marginTop: 4, fontSize: 12, color: colors.textTertiary }}>
              多个标签用中英文逗号分隔，保存后立即生效。
            </div>
          </div>
        </div>
      </Modal>

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
