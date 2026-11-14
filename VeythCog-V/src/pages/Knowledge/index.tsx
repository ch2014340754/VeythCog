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
import EmptyState from '@/components/states/EmptyState';
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
import { Button, Input, message, Modal, Popconfirm, Spin, Tag, Tooltip, Upload } from 'antd';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import DocEditor, { type DocEditorHandle } from './DocEditor';

/** 切换文档时的顶部细进度条：不遮挡内容，仅在右上角提示加载中 */
const SlimProgress: React.FC = () => (
  <div className="vc-doc-progress" aria-hidden>
    <span />
  </div>
);

const KnowledgePage: React.FC = () => {
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

  const importUpload = (
    <Upload
      showUploadList={false}
      accept=".md"
      beforeUpload={(file) => {
        void handleImport(file as File);
        return false;
      }}
    >
      <Button icon={<Icon icon={uploadIcon} width={14} />}>导入</Button>
    </Upload>
  );

  return (
    <div className="vc-subnav-layout vc-knowledge">
      <aside className="vc-subnav vc-knowledge-nav">
        <div className="vc-knowledge-nav__head">
          <span className="vc-eyebrow">Knowledge</span>
          <div className="vc-knowledge-nav__title">
            <h2 className="vc-subnav__title">知识库</h2>
            <span className="vc-meta">共 {total} 篇</span>
          </div>
          <Input
            prefix={<Icon icon={searchIcon} width={14} className="vc-search-icon" />}
            placeholder="搜索文档..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            allowClear
          />
          <div className="vc-knowledge-nav__actions">
            <Button type="primary" icon={<Icon icon={plusIcon} width={14} />} onClick={() => setCreateOpen(true)} block>
              新建
            </Button>
            {importUpload}
          </div>
        </div>

        <div className="vc-knowledge-list">
          {loading ? (
            <div className="vc-knowledge-list__loading">
              <Spin />
            </div>
          ) : docs.length === 0 ? (
            <div className="vc-knowledge-list__empty">暂无文档</div>
          ) : (
            docs.map((doc) => {
              const isActive = doc.id === activeDocId;
              return (
                <button
                  key={doc.id}
                  type="button"
                  className={'vc-doc-item' + (isActive ? ' is-active' : '')}
                  onClick={() => selectDoc(doc.id)}
                >
                  <span className="vc-doc-item__row">
                    <Icon icon={fileTextIcon} width={14} className="vc-doc-item__icon" />
                    <span className="vc-doc-item__title">{doc.title}</span>
                    {doc.isVectorized && (
                      <span className="vc-doc-item__zap">
                        <Icon icon={zapIcon} width={12} />
                      </span>
                    )}
                  </span>
                  {doc.tags && doc.tags.length > 0 && (
                    <span className="vc-doc-item__tags">
                      {doc.tags.slice(0, 3).map((t) => (
                        <span key={t} className="vc-tag-soft">{t}</span>
                      ))}
                    </span>
                  )}
                  <span className="vc-doc-item__time">{formatRelativeTime(doc.updatedAt)}</span>
                </button>
              );
            })
          )}
        </div>
      </aside>

      <div className="vc-knowledge-main">
        {!detail ? (
          <EmptyState
            icon={bookOpenIcon}
            title="选择或新建一个文档"
            description="从左侧挑选一篇，或者新建 / 导入 Markdown 开始写作。"
          >
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
          </EmptyState>
        ) : (
          <>
            {detailLoading && <SlimProgress />}
            <header className="vc-doc-head">
              <button
                type="button"
                className="vc-doc-head__title"
                onClick={() => editorRef.current?.focusTitle()}
                title="文档标题（与正文首个 # 标题同步，点击定位）"
              >
                {title || '未命名文档'}
              </button>
              {detail.isVectorized ? (
                <Tag color="success" icon={<Icon icon={zapIcon} width={12} />} style={{ margin: 0 }}>
                  已向量化
                </Tag>
              ) : (
                <Tag style={{ margin: 0 }}>未向量化</Tag>
              )}
              <div className="vc-doc-head__actions">
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
                <Tooltip title="保存">
                  <Button
                    type="primary"
                    icon={<Icon icon={saveIcon} width={14} />}
                    onClick={() => {
                      void handleSave();
                    }}
                    loading={saving}
                    disabled={detailLoading}
                  >
                    保存
                  </Button>
                </Tooltip>
                {detail.isVectorized ? (
                  <Tooltip title="取消向量化">
                    <Button
                      icon={<Icon icon={zapOffIcon} width={14} />}
                      onClick={handleUnvectorize}
                      loading={vectorizing}
                      disabled={detailLoading}
                    />
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
                <Popconfirm
                  title="确定删除该文档？"
                  onConfirm={() => handleDelete(detail.id)}
                  okText="删除"
                  cancelText="取消"
                >
                  <Tooltip title="删除">
                    <Button danger icon={<Icon icon={trashIcon} width={14} />} disabled={detailLoading} />
                  </Tooltip>
                </Popconfirm>
              </div>
            </header>

            <div className="vc-doc-body">
              <DocEditor
                key={detail.id}
                ref={editorRef}
                docId={detail.id}
                blockData={detail.blockData ?? '[]'}
                markdownText={detail.markdownText ?? ''}
                onTitleChange={setTitle}
              />
            </div>
          </>
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
        <div className="vc-stack">
          <div>
            <div className="vc-field-label">摘要</div>
            <Input.TextArea
              value={metaSummary}
              onChange={(e) => setMetaSummary(e.target.value)}
              placeholder="一句话概括文档内容（用于列表页展示）"
              autoSize={{ minRows: 3, maxRows: 8 }}
              maxLength={500}
              showCount
            />
            <div className="vc-hint">向量化时会按「仅填空值」自动补齐；也可点工具栏的 AI 按钮重新生成。</div>
          </div>
          <div>
            <div className="vc-field-label">标签</div>
            <Input
              value={metaTags}
              onChange={(e) => setMetaTags(e.target.value)}
              placeholder="逗号分隔，如：后端, 向量检索"
            />
            <div className="vc-hint">多个标签用中英文逗号分隔，保存后立即生效。</div>
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
        <div className="vc-stack">
          <Input
            placeholder="文档标题"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onPressEnter={handleCreate}
          />
          <div className="vc-hint">创建后可在编辑器中继续填写内容、标签与摘要。</div>
        </div>
      </Modal>
    </div>
  );
};

export default KnowledgePage;
