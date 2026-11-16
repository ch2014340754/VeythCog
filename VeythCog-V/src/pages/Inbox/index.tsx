/**
 * 收件箱 /inbox
 * ------------------------------------------------------------
 * 定位：网页剪藏落地的"待处理队列"。列表是冷的（只读浏览），
 * 三个动作把它变成热资产：入库（建知识文档 + 向量化）/ 丢弃 / 删除。
 * 交互按站点规范走"无感"：剪藏/入库后静默刷新列表，只在顶部细进度条说明在忙。
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Drawer, Empty, Input, message, Popconfirm, Segmented, Tag } from 'antd';
import ReactMarkdown from 'react-markdown';
import {
  clipByUrl,
  clipToKnowledge,
  deleteClipItem,
  getClipItem,
  listClipItems,
  updateClipItem,
  type ClipItemDetail,
  type ClipItemView,
} from '@/api/clip';
import { useClipStore } from '@/stores/clipStore';
import './inbox.css';

const STATUS_OPTIONS = [
  { label: '待处理', value: 'pending' },
  { label: '已入库', value: 'archived' },
  { label: '已丢弃', value: 'dropped' },
  { label: '全部', value: 'all' },
];

function formatTime(ts?: number | null): string {
  if (!ts) return '';
  const d = new Date(ts);
  const now = Date.now();
  const diff = now - ts;
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const STATUS_LABEL: Record<string, string> = {
  pending: '待处理',
  archived: '已入库',
  dropped: '已丢弃',
};

const InboxPage: React.FC = () => {
  const navigate = useNavigate();
  const refreshPending = useClipStore((s) => s.refreshPending);

  const [items, setItems] = React.useState<ClipItemView[]>([]);
  const [total, setTotal] = React.useState(0);
  const [status, setStatus] = React.useState('pending');
  const [keyword, setKeyword] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [url, setUrl] = React.useState('');

  const [preview, setPreview] = React.useState<ClipItemDetail | null>(null);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const [titleDraft, setTitleDraft] = React.useState('');
  const [tagDraft, setTagDraft] = React.useState('');

  const load = React.useCallback(
    async (opts?: { current?: number }) => {
      const pageNo = opts?.current ?? 1;
      setLoading(true);
      try {
        const res = await listClipItems({
          status,
          keyword: keyword.trim() || undefined,
          current: pageNo,
          pageSize: 15,
        });
        setItems(res.records ?? []);
        setTotal(res.total ?? 0);
        setPage(pageNo);
        refreshPending();
      } catch (e) {
        message.error((e as Error).message || '加载失败');
      } finally {
        setLoading(false);
      }
    },
    [status, keyword, refreshPending],
  );

  React.useEffect(() => {
    void load({ current: 1 });
    // 只跟筛选条件走；翻页由 pager 自己传 current
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, keyword]);

  /** 粘贴链接剪藏：成功后跳回"待处理"并刷新 */
  const handleClip = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    if (!/^https?:\/\//i.test(trimmed)) {
      message.warning('请输入以 http:// 或 https:// 开头的链接');
      return;
    }
    setBusy(true);
    try {
      const item = await clipByUrl(trimmed);
      setUrl('');
      if (item.status === 'pending' && !item.error) {
        message.success(`已收进收件箱：${item.title || item.site}`);
      } else if (item.error) {
        message.warning(`已记录，但抓取失败：${item.error}`);
      } else {
        message.info('这条链接之前已经剪藏过，收件箱里已保留原记录');
      }
      if (status !== 'pending' && status !== 'all') setStatus('pending');
      await load({ current: 1 });
    } catch (e) {
      message.error((e as Error).message || '剪藏失败');
    } finally {
      setBusy(false);
    }
  };

  const openPreview = async (item: ClipItemView) => {
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreview(null);
    try {
      const detail = await getClipItem(item.id);
      setPreview(detail);
      setTitleDraft(detail.title);
      setTagDraft((detail.tags ?? []).join(', '));
    } catch (e) {
      message.error((e as Error).message || '打开失败');
      setPreviewOpen(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  const savePreviewEdit = async () => {
    if (!preview) return;
    try {
      await updateClipItem(preview.id, {
        title: titleDraft.trim(),
        tags: tagDraft
          .split(/[,，\s]+/)
          .map((t) => t.trim())
          .filter(Boolean),
      });
      message.success('已保存');
      setPreview((prev) => (prev ? { ...prev, title: titleDraft.trim() } : prev));
      void load({ current: page });
    } catch (e) {
      message.error((e as Error).message || '保存失败');
    }
  };

  const handleImport = async (item: ClipItemView) => {
    setBusy(true);
    try {
      const result = await clipToKnowledge(item.id);
      if (result.alreadyImported) {
        message.info('这条已经入库过，直接打开文档');
      } else if (result.vectorized) {
        message.success(`已入库并向量化（${result.chunkCount} 个分片），可在对话里检索到它`);
      } else {
        message.warning(`文档已建好，但向量化失败：${result.error || '请到知识库页手动重试'}`);
      }
      setPreviewOpen(false);
      await load({ current: page });
      refreshPending();
      if (result.docId) {
        // 入库是明确动作，用户此刻就是要去看文档，直接跳过去更省一步
        navigate(`/knowledge?docId=${result.docId}`);
      }
    } catch (e) {
      message.error((e as Error).message || '入库失败');
    } finally {
      setBusy(false);
    }
  };

  const handleDrop = async (item: ClipItemView) => {
    try {
      await updateClipItem(item.id, { status: 'dropped' });
      message.success('已标记为丢弃（仍可在「已丢弃」里找回）');
      await load({ current: page });
      refreshPending();
    } catch (e) {
      message.error((e as Error).message || '操作失败');
    }
  };

  const handleDelete = async (item: ClipItemView) => {
    try {
      await deleteClipItem(item.id);
      message.success('已删除');
      setPreviewOpen(false);
      await load({ current: page });
      refreshPending();
    } catch (e) {
      message.error((e as Error).message || '删除失败');
    }
  };

  const canPrev = page > 1;
  const canNext = page * 15 < total;

  return (
    <div className="vc-inbox">
      <header className="vc-inbox__head">
        <div className="vc-inbox__heading">
          <h1>收件箱</h1>
          <p>网页剪藏的落点：先攒起来，再决定哪些值得进知识库。</p>
        </div>
        <div className="vc-inbox__count">
          待处理 {items.filter((i) => i.status === 'pending').length}
          <span> / 本页 {items.length} 条 · 共 {total} 条</span>
        </div>
      </header>

      <div className="vc-inbox__clipbar">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onPressEnter={() => void handleClip()}
          placeholder="粘贴网页链接，服务端抓正文、转 Markdown 收进收件箱"
          allowClear
          className="vc-inbox__url"
        />
        <Button type="primary" loading={busy} onClick={() => void handleClip()}>
          剪藏
        </Button>
        <Button
          type="text"
          onClick={() => navigate('/settings/account')}
          className="vc-inbox__token-link"
          title="剪藏令牌与书签脚本"
        >
          书签脚本
        </Button>
      </div>

      <div className="vc-inbox__toolbar">
        <Segmented
          value={status}
          options={STATUS_OPTIONS}
          onChange={(value) => {
            setStatus(value as string);
            setPage(1);
          }}
        />
        <Input.Search
          className="vc-inbox__search"
          placeholder="搜标题 / 站点"
          allowClear
          onSearch={(value) => {
            setKeyword(value);
            setPage(1);
          }}
        />
        <Button loading={loading} onClick={() => void load({ current: page })}>
          刷新
        </Button>
      </div>

      {loading && items.length > 0 && <div className="vc-inbox__progress" aria-hidden />}

      {!loading && items.length === 0 ? (
        <div className="vc-inbox__empty">
          <Empty
            description={
              status === 'pending'
                ? '还没有待处理的剪藏：粘个链接试试，或在设置里拖一个书签脚本到书签栏'
                : '这个筛选下没有内容'
            }
          />
        </div>
      ) : (
        <ul className="vc-inbox__list">
          {items.map((item) => (
            <li key={item.id} className={`vc-inbox__item is-${item.status}`}>
              <div className="vc-inbox__item-main" onClick={() => void openPreview(item)}>
                <div className="vc-inbox__item-title-row">
                  <h3 className="vc-inbox__item-title">{item.title || item.url || '未命名剪藏'}</h3>
                  {item.status !== 'pending' && (
                    <Tag className="vc-inbox__status">{STATUS_LABEL[item.status] ?? item.status}</Tag>
                  )}
                  {item.quality === 'fallback' && (
                    <Tag className="vc-inbox__status is-warn" title="正文提取不理想，回退成整页文本">
                      整页
                    </Tag>
                  )}
                </div>
                <p className="vc-inbox__item-excerpt">{item.error ? `抓取失败：${item.error}` : item.excerpt}</p>
                <div className="vc-inbox__item-meta">
                  <span>{item.site || '未知站点'}</span>
                  {item.wordCount ? <span>{item.wordCount} 字</span> : null}
                  {item.channel === 'bookmarklet' ? <span>书签</span> : null}
                  <span>{formatTime(item.createdAt)}</span>
                  {(item.tags ?? []).map((tag) => (
                    <Tag key={tag} className="vc-inbox__tag">
                      {tag}
                    </Tag>
                  ))}
                </div>
              </div>
              <div className="vc-inbox__item-actions">
                {item.status !== 'archived' && (
                  <Button
                    type="primary"
                    size="small"
                    disabled={!!item.error}
                    onClick={() => void handleImport(item)}
                  >
                    入库
                  </Button>
                )}
                {item.status === 'archived' && item.docId ? (
                  <Button size="small" onClick={() => navigate(`/knowledge?docId=${item.docId}`)}>
                    看文档
                  </Button>
                ) : null}
                {item.status === 'pending' && (
                  <Button size="small" type="text" onClick={() => void handleDrop(item)}>
                    丢弃
                  </Button>
                )}
                <Popconfirm
                  title="删除这条剪藏？"
                  description="正文会一并清除，且不可恢复"
                  okText="删除"
                  cancelText="取消"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => void handleDelete(item)}
                >
                  <Button size="small" type="text" danger>
                    删除
                  </Button>
                </Popconfirm>
                {item.url ? (
                  <a className="vc-inbox__open" href={item.url} target="_blank" rel="noreferrer noopener">
                    原文
                  </a>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {total > 15 && (
        <div className="vc-inbox__pager">
          <Button disabled={!canPrev} onClick={() => void load({ current: Math.max(1, page - 1) })}>
            上一页
          </Button>
          <span>
            {page} / {Math.max(1, Math.ceil(total / 15))}
          </span>
          <Button disabled={!canNext} onClick={() => void load({ current: page + 1 })}>
            下一页
          </Button>
        </div>
      )}

      <Drawer
        title="剪藏预览"
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        width={Math.min(760, window.innerWidth - 40)}
        className="vc-inbox__drawer"
        extra={
          preview ? (
            <div className="vc-inbox__drawer-extra">
              <Button onClick={() => void savePreviewEdit()}>保存修改</Button>
              {preview.status !== 'archived' && (
                <Button
                  type="primary"
                  disabled={!!preview.error || !preview.contentMd}
                  loading={busy}
                  onClick={() => void handleImport(preview)}
                >
                  入库
                </Button>
              )}
            </div>
          ) : null
        }
      >
        {previewLoading ? (
          <div className="vc-inbox__drawer-loading">正在读取…</div>
        ) : preview ? (
          <div className="vc-inbox__preview">
            <div className="vc-inbox__preview-fields">
              <label>
                <span>标题</span>
                <Input value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)} />
              </label>
              <label>
                <span>标签（逗号分隔）</span>
                <Input value={tagDraft} onChange={(e) => setTagDraft(e.target.value)} placeholder="例如：技术, 长文" />
              </label>
              <div className="vc-inbox__preview-meta">
                <span>{preview.site}</span>
                {preview.wordCount ? <span>{preview.wordCount} 字</span> : null}
                <span>{formatTime(preview.createdAt)}</span>
                {preview.url ? (
                  <a href={preview.url} target="_blank" rel="noreferrer noopener">
                    打开原文
                  </a>
                ) : null}
              </div>
            </div>
            {preview.error ? <div className="vc-inbox__preview-error">抓取失败：{preview.error}</div> : null}
            <div className="vc-inbox__md">
              <ReactMarkdown>{preview.contentMd || '（无正文）'}</ReactMarkdown>
            </div>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
};

export default InboxPage;
