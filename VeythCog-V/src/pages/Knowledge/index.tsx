import {
    createDoc,
    deleteDoc,
    exportMd,
    exportZip,
    getDoc,
    getTree,
    importMd,
    moveDoc,
    regenerateMetadata,
    unvectorize,
    updateDoc,
    vectorize,
} from '@/api/knowledge';
import EmptyState from '@/components/states/EmptyState';
import type { DocDetail, KnowledgeTree } from '@/types';
import alignLeftIcon from '@iconify-icons/lucide/align-left';
import bookOpenIcon from '@iconify-icons/lucide/book-open';
import downloadIcon from '@iconify-icons/lucide/download';
import fileTextIcon from '@iconify-icons/lucide/file-text';
import filesIcon from '@iconify-icons/lucide/files';
import folderPlusIcon from '@iconify-icons/lucide/folder-plus';
import plusIcon from '@iconify-icons/lucide/plus';
import saveIcon from '@iconify-icons/lucide/save';
import searchIcon from '@iconify-icons/lucide/search';
import sparklesIcon from '@iconify-icons/lucide/sparkles';
import trashIcon from '@iconify-icons/lucide/trash-2';
import uploadIcon from '@iconify-icons/lucide/upload';
import zapIcon from '@iconify-icons/lucide/zap';
import zapOffIcon from '@iconify-icons/lucide/zap-off';
import { Icon } from '@iconify/react';
import { Button, Input, message, Modal, Popconfirm, Tag, Tooltip, Upload } from 'antd';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import DocEditor, { type DocEditorHandle } from './DocEditor';
import DocTree, { type DocTreeHandle } from './DocTree';

/** 切换文档时的顶部细进度条：不遮挡内容，仅在右上角提示加载中 */
const SlimProgress: React.FC = () => (
  <div className="vc-doc-progress" aria-hidden>
    <span />
  </div>
);

const KnowledgePage: React.FC = () => {
  const [tree, setTree] = useState<KnowledgeTree | null>(null);
  /** 全量树快照：清空搜索框时直接复用，不必再打一次接口 */
  const fullTreeRef = useRef<KnowledgeTree | null>(null);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeDocId, setActiveDocId] = useState<number | null>(null);
  /** 当前选中的目录：新建文档 / 导入的默认落点 */
  const [activeFolderId, setActiveFolderId] = useState<number | null>(null);
  const docTreeRef = useRef<DocTreeHandle>(null);

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
  /** 新建文档的目标目录（打开弹窗时锁定，避免途中选中变化） */
  const [createFolderId, setCreateFolderId] = useState<number | null>(null);

  /**
   * 拉取全量知识树。
   * @param opts.silent 静默刷新：不切换 loading（侧栏不闪 Spin），
   *                    用于保存 / 向量化 / 删除 / 拖拽后的数据同步
   */
  const loadFullTree = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    if (!silent) setLoading(true);
    try {
      const data = await getTree();
      fullTreeRef.current = data;
      setTree(data);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载知识库失败');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  /** 关键词检索：后端只返回命中文档 + 其祖先目录 */
  const searchTree = useCallback(async (kw: string) => {
    if (!kw) return;
    setLoading(true);
    try {
      const data = await getTree({ keyword: kw });
      setTree(data);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '搜索失败');
    } finally {
      setLoading(false);
    }
  }, []);

  /** 静默同步树（不闪加载态） */
  const refreshTreeSilently = useCallback(() => {
    void loadFullTree({ silent: true });
  }, [loadFullTree]);

  useEffect(() => {
    void loadFullTree();
  }, [loadFullTree]);

  // 搜索防抖 300ms；清空关键词直接回放全量快照，无网络往返
  useEffect(() => {
    const kw = keyword.trim();
    if (!kw) {
      if (fullTreeRef.current) setTree(fullTreeRef.current);
      return;
    }
    const timer = setTimeout(() => {
      void searchTree(kw);
    }, 300);
    return () => clearTimeout(timer);
  }, [keyword, searchTree]);

  /** 树组件回调：先落全量快照，再静默刷新 */
  const handleTreeRefresh = useCallback(
    (opts?: { silent?: boolean }) => {
      if (keyword.trim()) {
        void searchTree(keyword.trim());
        return;
      }
      void loadFullTree(opts);
    },
    [keyword, loadFullTree, searchTree]
  );

  /** 树里删除的文档若正打开着，清空编辑区 */
  const handleDocsRemoved = useCallback(
    (docIds: number[]) => {
      if (activeDocId != null && docIds.includes(activeDocId)) {
        setActiveDocId(null);
        setDetail(null);
      }
    },
    [activeDocId]
  );

  /** 树里改名后同步头部标题，不必重拉详情 */
  const handleDocRenamed = useCallback((docId: number, nextTitle: string) => {
    setDetail((prev) => (prev && prev.id === docId ? { ...prev, title: nextTitle } : prev));
    setTitle((prev) => prev || nextTitle);
  }, []);

  const openCreateDoc = useCallback((folderId: number | null) => {
    setCreateFolderId(folderId);
    setNewTitle('');
    setCreateOpen(true);
  }, []);

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
      setTitle(payload.title);
      setSummary(summaryValue);
      setTagsText(tags.join(', '));
      message.success('已保存（内容变更后需重新向量化）');
      void refreshTreeSilently();
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
      folderId: createFolderId,
    };
    setSaving(true);
    try {
      const id = await createDoc(payload);
      message.success('已创建');
      setCreateOpen(false);
      setNewTitle('');
      await loadFullTree({ silent: true });
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
      await loadFullTree({ silent: true });
    } catch (e) {
      message.error(e instanceof Error ? e.message : '删除失败');
    }
  };

  /** 应用后端生成的元数据：只改摘要/标签等元信息，不碰 blockData，避免编辑器重解析 */
  const applyGeneratedMetadata = (nextSummary?: string | null, nextTags?: string[] | null) => {
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
  };

  const handleRegenerateMetadata = async () => {
    if (!detail) return;
    setMetaGenerating(true);
    try {
      const meta = await regenerateMetadata(detail.id);
      applyGeneratedMetadata(meta.summary, meta.tags);
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
      // 后端已按"仅填空值"补齐摘要/标签，这里直接应用，避免额外拉详情
      applyGeneratedMetadata(result.summary, result.tags);
      void refreshTreeSilently();
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
      void refreshTreeSilently();
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

  /** 批量导入：支持一次选多个 .md，逐个建档并挂到当前目录 */
  const handleImport = async (files: File[]) => {
    const mdFiles = files.filter((f) => f.name.toLowerCase().endsWith('.md'));
    if (mdFiles.length === 0) {
      message.error('仅支持 .md 文件');
      return;
    }
    const valid = mdFiles.filter((f) => f.size <= 500 * 1024);
    const oversize = mdFiles.length - valid.length;
    if (valid.length === 0) {
      message.error('文件超过 500KB');
      return;
    }
    let ok = 0;
    let fail = 0;
    let lastId: number | null = null;
    for (const file of valid) {
      try {
        const id = await importMd(file, file.name.replace(/\.md$/i, ''));
        // 导入接口不带目录参数：先进根级，再挂到当前选中的目录
        if (activeFolderId != null) {
          await moveDoc(id, activeFolderId);
        }
        ok += 1;
        lastId = id;
      } catch {
        fail += 1;
      }
    }
    const tail = [oversize > 0 ? `跳过 ${oversize} 个超 500KB` : '', fail > 0 ? `失败 ${fail} 篇` : '']
      .filter(Boolean)
      .join('，');
    if (ok > 0) {
      message.success(`已导入 ${ok} 篇${tail ? `（${tail}）` : ''}`);
      await loadFullTree({ silent: true });
      if (lastId != null) await selectDoc(lastId);
    } else {
      message.error(`导入失败${tail ? `（${tail}）` : ''}`);
    }
  };

  /** 批量导出：当前目录（含子目录）或全库打 zip；用后端算目录路径，前端不拼 */
  const handleExportZip = async () => {
    const label =
      activeFolderId != null
        ? tree?.folders.find((f) => f.id === activeFolderId)?.name ?? '当前目录'
        : '全部文档';
    try {
      await exportZip(
        activeFolderId,
        undefined,
        activeFolderId != null ? `knowledge-${label}.zip` : 'knowledge-all.zip'
      );
      message.success(`已导出：${label}`);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '批量导出失败');
    }
  };

  /** 批量导出选中：左侧 Ctrl / ⌘ 多选出来的文档（至少含当前打开的一篇） */
  const handleExportSelected = async () => {
    const ids = docTreeRef.current?.getSelectedDocIds() ?? [];
    if (ids.length === 0) {
      message.warning('先在左侧选中要导出的文档（Ctrl / ⌘ 可多选）');
      return;
    }
    try {
      await exportZip(null, ids, `knowledge-selected-${ids.length}.zip`);
      message.success(`已导出 ${ids.length} 篇选中文档`);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '批量导出失败');
    }
  };

  /** 隐藏文件选择器：新建 / 导入两个按钮的「滑出菜单」共用 */
  const importInputRef = useRef<HTMLInputElement>(null);

  /** 新建弹窗里显示的落点目录名 */
  const createFolderName =
    createFolderId == null
      ? '根目录'
      : tree?.folders.find((f) => f.id === createFolderId)?.name ?? '根目录';

  return (
    <div className="vc-subnav-layout vc-knowledge">
      <aside className="vc-subnav vc-knowledge-nav">
        <div className="vc-knowledge-nav__head">
          <span className="vc-eyebrow">Knowledge</span>
          <div className="vc-knowledge-nav__title">
            <h2 className="vc-subnav__title">知识库</h2>
            <span className="vc-meta">
              共 {tree?.total ?? 0} 篇
              {keyword.trim() && tree ? ` · 命中 ${tree.matchedCount}` : ''}
            </span>
          </div>
          <Input
            prefix={<Icon icon={searchIcon} width={14} className="vc-search-icon" />}
            placeholder="搜索文档..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            allowClear
          />
          <div className="vc-knowledge-nav__actions">
            <div className="vc-kb-action">
              <Button
                type="primary"
                icon={<Icon icon={plusIcon} width={14} />}
                onClick={() => openCreateDoc(activeFolderId)}
                block
              >
                新建
              </Button>
              <div className="vc-kb-action__panel">
                <div className="vc-kb-action__card">
                  <button
                    type="button"
                    className="vc-kb-action__item"
                    onClick={() => openCreateDoc(activeFolderId)}
                  >
                    <Icon icon={fileTextIcon} width={14} />
                    <span>新建文档</span>
                  </button>
                  <button
                    type="button"
                    className="vc-kb-action__item"
                    onClick={() => docTreeRef.current?.openCreateFolder(activeFolderId)}
                  >
                    <Icon icon={folderPlusIcon} width={14} />
                    <span>新建文件夹</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="vc-kb-action vc-kb-action--end">
              <Button
                icon={<Icon icon={uploadIcon} width={14} />}
                onClick={() => importInputRef.current?.click()}
                block
              >
                导入
              </Button>
              <div className="vc-kb-action__panel">
                <div className="vc-kb-action__card">
                  <button
                    type="button"
                    className="vc-kb-action__item"
                    onClick={() => importInputRef.current?.click()}
                  >
                    <Icon icon={uploadIcon} width={14} />
                    <span>导入 Markdown（可多选）</span>
                  </button>
                  <button
                    type="button"
                    className="vc-kb-action__item"
                    onClick={() => void handleExportZip()}
                  >
                    <Icon icon={downloadIcon} width={14} />
                    <span>批量导出{activeFolderId != null ? '当前目录' : '全部文档'}</span>
                  </button>
                  <button
                    type="button"
                    className="vc-kb-action__item"
                    onClick={() => void handleExportSelected()}
                  >
                    <Icon icon={filesIcon} width={14} />
                    <span>批量导出选中文件</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
          <input
            ref={importInputRef}
            type="file"
            accept=".md"
            multiple
            hidden
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = '';
              if (files.length > 0) void handleImport(files);
            }}
          />
        </div>

        <DocTree
          ref={docTreeRef}
          tree={tree}
          loading={loading}
          keyword={keyword}
          activeDocId={activeDocId}
          onOpenDoc={(id) => void selectDoc(id)}
          onCreateDoc={openCreateDoc}
          onRefresh={handleTreeRefresh}
          onDocsRemoved={handleDocsRemoved}
          onDocRenamed={handleDocRenamed}
          onActiveFolderChange={setActiveFolderId}
        />
      </aside>

      <div className="vc-knowledge-main">
        {!detail ? (
          <EmptyState
            icon={bookOpenIcon}
            title="选择或新建一个文档"
            description="从左侧挑选一篇，或者新建 / 导入 Markdown 开始写作。"
          >
            <Button type="primary" icon={<Icon icon={plusIcon} width={14} />} onClick={() => openCreateDoc(activeFolderId)}>
              新建文档
            </Button>
            <Upload
              showUploadList={false}
              accept=".md"
              multiple
              beforeUpload={(file) => {
                void handleImport([file as File]);
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
          <div className="vc-hint">将创建到「{createFolderName}」；创建后可在编辑器中继续填写内容、标签与摘要。</div>
        </div>
      </Modal>
    </div>
  );
};

export default KnowledgePage;
