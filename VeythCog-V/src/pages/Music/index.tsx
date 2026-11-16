import {
  AMBIENT_MAX,
  LICENSE_LABELS,
  MAX_DURATION_MS,
  MAX_FILE_BYTES,
  SOURCE_LABELS,
  deleteTrack,
  formatDuration,
  listAmbientTracks,
  listTracks,
  readAudioDuration,
  setTrackAmbient,
  updateTrack,
  uploadTrack,
  type MusicTrack,
  type TrackLicense,
  type TrackSource,
} from '@/api/music';
import EmptyState from '@/components/states/EmptyState';
import { useMusicStore } from '@/stores/musicStore';
import alertIcon from '@iconify-icons/lucide/alert-circle';
import musicIcon from '@iconify-icons/lucide/music';
import plusIcon from '@iconify-icons/lucide/plus';
import searchIcon from '@iconify-icons/lucide/search';
import trashIcon from '@iconify-icons/lucide/trash-2';
import uploadIcon from '@iconify-icons/lucide/upload';
import { Icon } from '@iconify/react';
import { Button, Input, message, Modal, Select, Switch, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './music.css';

/** 派生「更新」事件：播放器监听后静默刷新，避免它拿到过期的曲库 */
const emitMusicChanged = () => window.dispatchEvent(new Event('veythcog:music-changed'));

interface UploadDraft {
  file: File | null;
  durationMs: number;
  title: string;
  artist: string;
  source: TrackSource;
  license: TrackLicense;
  attribution: string;
  licenseUrl: string;
  aiDisclosure: boolean;
  aiModel: string;
  tagsText: string;
}

const emptyDraft = (): UploadDraft => ({
  file: null,
  durationMs: 0,
  title: '',
  artist: '',
  source: 'UPLOAD',
  license: 'OWNED',
  attribution: '',
  licenseUrl: '',
  aiDisclosure: false,
  aiModel: '',
  tagsText: '',
});

const splitTags = (text: string) =>
  text
    .split(/[,，\s]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 8);

const MusicPage: React.FC = () => {
  const setAmbientOn = useMusicStore((s) => s.setAmbientOn);

  const [rows, setRows] = useState<MusicTrack[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [keyword, setKeywordText] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState('');
  const [source, setSource] = useState<TrackSource | undefined>(undefined);
  const [ambientOnly, setAmbientOnly] = useState(false);
  const [sortField, setSortField] = useState<'createdAt' | 'updatedAt' | 'title' | 'durationMs'>('createdAt');

  /** 首次 / 筛选变化的整表加载（有 loading 态） */
  const [loading, setLoading] = useState(true);
  /** 静默刷新（只有细进度条，列表内容原地不动） */
  const [refreshing, setRefreshing] = useState(false);
  const [ambientCount, setAmbientCount] = useState(0);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [draft, setDraft] = useState<UploadDraft>(emptyDraft);
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState<MusicTrack | null>(null);
  const [editDraft, setEditDraft] = useState({
    title: '',
    artist: '',
    source: 'UPLOAD' as TrackSource,
    license: 'OWNED' as TrackLicense,
    attribution: '',
    aiDisclosure: false,
    aiModel: '',
    tagsText: '',
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // 搜索防抖 300ms
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedKeyword(keyword.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [keyword]);

  /**
   * 加载列表。
   * @param silent 静默刷新：不切 loading（列表不闪），只在顶部走一条细进度线
   */
  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent ?? false;
      if (silent) setRefreshing(true);
      else setLoading(true);
      try {
        const [res, ambient] = await Promise.all([
          listTracks({
            keyword: debouncedKeyword || undefined,
            source,
            ambientOnly,
            current: page,
            pageSize,
            sortField,
            sortOrder: 'descend',
          }),
          listAmbientTracks().catch(() => []),
        ]);
        setRows(res.records);
        setTotal(res.total);
        setAmbientCount(ambient.length);
      } catch (e) {
        message.error(e instanceof Error ? e.message : '加载音乐库失败');
      } finally {
        if (silent) setRefreshing(false);
        else setLoading(false);
      }
    },
    [debouncedKeyword, source, ambientOnly, page, pageSize, sortField],
  );

  useEffect(() => {
    void load();
  }, [load]);

  // ===== 上传 =====
  const onPickFile = async (file: File | null | undefined) => {
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!/\.(mp3|m4a)$/.test(name)) {
      message.error('仅支持 mp3 / m4a 格式');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      message.error('音频超过 20MB 上限');
      return;
    }
    const durationMs = await readAudioDuration(file);
    if (durationMs > MAX_DURATION_MS) {
      message.error('音频时长超过 10 分钟上限');
      return;
    }
    setDraft((d) => ({
      ...d,
      file,
      durationMs,
      // 标题留空时用文件名（和后端兜底规则一致），用户可以改
      title: d.title || file.name.replace(/\.[^.]+$/, ''),
    }));
  };

  const submitUpload = async () => {
    if (!draft.file) {
      message.warning('请先选择音频文件');
      return;
    }
    if (draft.license === 'CC-BY' && !draft.attribution.trim()) {
      message.warning('许可为 CC-BY 时必须填写署名');
      return;
    }
    if (draft.aiDisclosure && !draft.aiModel.trim()) {
      message.warning('勾选 AI 生成时必须填写模型标识');
      return;
    }
    setSubmitting(true);
    try {
      await uploadTrack(draft.file, {
        title: draft.title.trim() || undefined,
        artist: draft.artist.trim() || undefined,
        durationMs: draft.durationMs,
        source: draft.source,
        license: draft.license,
        attribution: draft.attribution.trim(),
        licenseUrl: draft.licenseUrl.trim(),
        aiDisclosure: draft.aiDisclosure,
        aiModel: draft.aiModel.trim(),
        tags: splitTags(draft.tagsText),
      });
      message.success('已加入曲库');
      setUploadOpen(false);
      setDraft(emptyDraft());
      setPage(1);
      await load({ silent: true });
      emitMusicChanged();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '上传失败');
    } finally {
      setSubmitting(false);
    }
  };

  // ===== 编辑 =====
  const openEdit = (track: MusicTrack) => {
    setEditing(track);
    setEditDraft({
      title: track.title,
      artist: track.artist,
      source: track.source,
      license: track.license,
      attribution: track.attribution,
      aiDisclosure: track.aiDisclosure,
      aiModel: track.aiModel,
      tagsText: track.tags.join('，'),
    });
  };

  const submitEdit = async () => {
    if (!editing) return;
    if (!editDraft.title.trim()) {
      message.warning('标题不能为空');
      return;
    }
    if (editDraft.license === 'CC-BY' && !editDraft.attribution.trim()) {
      message.warning('许可为 CC-BY 时必须填写署名');
      return;
    }
    if (editDraft.aiDisclosure && !editDraft.aiModel.trim()) {
      message.warning('勾选 AI 生成时必须填写模型标识');
      return;
    }
    setSavingEdit(true);
    try {
      await updateTrack(editing.id, {
        title: editDraft.title.trim(),
        artist: editDraft.artist.trim(),
        source: editDraft.source,
        license: editDraft.license,
        attribution: editDraft.attribution.trim(),
        aiDisclosure: editDraft.aiDisclosure,
        aiModel: editDraft.aiModel.trim(),
        tags: splitTags(editDraft.tagsText),
      });
      message.success('已保存');
      setEditing(null);
      await load({ silent: true });
      emitMusicChanged();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSavingEdit(false);
    }
  };

  // ===== 背景音 =====
  const toggleAmbient = async (track: MusicTrack, enabled: boolean) => {
    if (enabled && ambientCount >= AMBIENT_MAX) {
      message.warning(`背景音池最多 ${AMBIENT_MAX} 首，请先移除其他曲目`);
      return;
    }
    try {
      await setTrackAmbient(track.id, enabled);
      message.success(enabled ? '已加入背景音池' : '已移出背景音池');
      await load({ silent: true });
      emitMusicChanged();
    } catch (e) {
      message.error(e instanceof Error ? e.message : '操作失败');
    }
  };

  // ===== 删除 =====
  const confirmDelete = (track: MusicTrack) => {
    Modal.confirm({
      title: '删除曲目',
      content: `确定从曲库删除《${track.title}》？音频文件会一并清理，删除后不可恢复。`,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteTrack(track.id);
          message.success('已删除');
          if (rows.length === 1 && page > 1) setPage((p) => p - 1);
          await load({ silent: true });
          emitMusicChanged();
        } catch (e) {
          message.error(e instanceof Error ? e.message : '删除失败');
        }
      },
    });
  };

  // ===== 背景音开关入口（页面头部） =====
  const ambientEnabledCount = ambientCount;
  const inAmbientMode = useMusicStore((s) => s.ambientOn);
  const toggleAmbientMode = () => {
    if (inAmbientMode) {
      setAmbientOn(false);
      return;
    }
    if (ambientEnabledCount === 0) {
      message.info(`背景音池为空：先把下方曲目加入背景音（最多 ${AMBIENT_MAX} 首）`);
      return;
    }
    setAmbientOn(true);
    message.success('背景音已开启（播放器低音量循环）');
  };

  const columns: ColumnsType<MusicTrack> = useMemo(
    () => [
      {
        title: '曲目',
        dataIndex: 'title',
        render: (_, track) => (
          <div className="vc-music__track">
            <div
              className="vc-music__cover"
              style={{
                background: `linear-gradient(135deg, ${track.coverColor[0] ?? '#7C3AED'}, ${
                  track.coverColor[1] ?? '#06B6D4'
                })`,
              }}
            >
              {track.title.charAt(0)}
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="vc-music__name">
                <span className="vc-music__title" title={track.title}>
                  {track.title}
                </span>
                {track.aiDisclosure && <span className="vc-music__badge vc-music__badge--ai">AI 生成</span>}
                {track.status !== 'published' && <span className="vc-music__badge">已下架</span>}
              </div>
              <div className="vc-music__sub">
                {track.tags.length ? track.tags.map((t) => `#${t}`).join(' ') : '—'}
              </div>
            </div>
          </div>
        ),
      },
      {
        title: '艺人',
        dataIndex: 'artist',
        width: 150,
        render: (value: string) => value || '—',
      },
      {
        title: '时长',
        dataIndex: 'durationMs',
        width: 80,
        render: (value: number) => formatDuration(value),
      },
      {
        title: '来源',
        dataIndex: 'source',
        width: 120,
        render: (value: TrackSource) => SOURCE_LABELS.find((s) => s.value === value)?.label ?? value,
      },
      {
        title: '许可',
        dataIndex: 'license',
        width: 130,
        render: (value: TrackLicense, track) => {
          const label = LICENSE_LABELS.find((l) => l.value === value)?.label ?? value;
          const tip = track.attribution || track.licenseUrl;
          return (
            <Tag color={value === 'CC-BY' ? 'warning' : value === 'OWNED' ? 'success' : 'default'} title={tip}>
              {label}
            </Tag>
          );
        },
      },
      {
        title: '背景音',
        dataIndex: 'ambientEnabled',
        width: 96,
        render: (value: boolean, track) => (
          <Switch
            size="small"
            checked={value}
            onChange={(next) => void toggleAmbient(track, next)}
            aria-label="加入背景音池"
          />
        ),
      },
      {
        title: '操作',
        width: 150,
        render: (_, track) => (
          <div className="vc-toolbar" style={{ gap: 4 }}>
            <Button size="small" type="text" onClick={() => openEdit(track)}>
              编辑
            </Button>
            <Button
              size="small"
              type="text"
              danger
              onClick={() => confirmDelete(track)}
              aria-label="删除"
              title="删除"
            >
              <Icon icon={trashIcon} width={15} />
            </Button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ambientCount, rows],
  );

  return (
    <div className="vc-page">
      <div className="vc-page__body vc-page__body--wide">
        {/* 页头 */}
        <div className="vc-page-head">
          <div className="vc-page-head__main">
            <div className="vc-eyebrow">MUSIC LIBRARY</div>
            <h1 className="vc-title">音乐库</h1>
            <div className="vc-desc">
              上传本地 / AI 生成音频，标注许可与署名；加入背景音池的曲目会由右下角播放器低音量循环。
              仅支持 mp3 / m4a，单文件 ≤ 20MB、时长 ≤ 10 分钟，CC-BY-NC 许可不予收录。
            </div>
          </div>
          <div className="vc-toolbar" style={{ alignItems: 'center' }}>
            <span
              className={'vc-music__stat' + (ambientCount >= AMBIENT_MAX ? ' vc-music__stat--full' : '')}
              title="背景音池上限 8 首"
            >
              <Icon icon={musicIcon} width={15} />
              背景音 {ambientCount}/{AMBIENT_MAX}
            </span>
            <Button
              size="middle"
              onClick={toggleAmbientMode}
              aria-pressed={inAmbientMode}
              type={inAmbientMode ? 'default' : 'dashed'}
            >
              {inAmbientMode ? '关闭背景音' : '开启背景音'}
            </Button>
            <Button type="primary" icon={<Icon icon={plusIcon} width={16} />} onClick={() => setUploadOpen(true)}>
              上传音频
            </Button>
          </div>
        </div>

        {/* 工具栏：搜索 / 来源 / 只看背景音 / 排序 */}
        <div className="vc-toolbar vc-toolbar--between" style={{ marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <div className="vc-toolbar" style={{ flexWrap: 'wrap', gap: 8 }}>
            <Input
              allowClear
              prefix={<Icon icon={searchIcon} width={15} />}
              placeholder="搜索标题 / 艺人"
              value={keyword}
              onChange={(e) => setKeywordText(e.target.value)}
              style={{ width: 220 }}
            />
            <Select<TrackSource | undefined>
              allowClear
              placeholder="全部来源"
              style={{ width: 150 }}
              value={source}
              onChange={(value) => {
                setSource(value);
                setPage(1);
              }}
              options={SOURCE_LABELS.map((s) => ({ value: s.value, label: s.label }))}
            />
            <Select
              style={{ width: 140 }}
              value={sortField}
              onChange={(value) => {
                setSortField(value);
                setPage(1);
              }}
              options={[
                { value: 'createdAt', label: '最近添加' },
                { value: 'updatedAt', label: '最近更新' },
                { value: 'title', label: '标题' },
                { value: 'durationMs', label: '时长' },
              ]}
            />
            <span className="vc-music__label" style={{ fontSize: 12 }}>只看背景音</span>
            <Switch
              checked={ambientOnly}
              onChange={(next) => {
                setAmbientOnly(next);
                setPage(1);
              }}
              aria-label="只看背景音池"
            />
          </div>
          <div className="vc-music__sub">共 {total} 首</div>
        </div>

        {/* 静默刷新细进度条 */}
        <div className={'vc-music__slim' + (refreshing ? ' is-on' : '')} aria-hidden>
          <span />
        </div>

        <div className="vc-panel vc-panel--flush">
          <Table<MusicTrack>
            rowKey="id"
            size="middle"
            loading={loading}
            columns={columns}
            dataSource={rows}
            locale={{
              emptyText: (
                <EmptyState
                  icon={musicIcon}
                  title={debouncedKeyword || source || ambientOnly ? '没有符合条件的曲目' : '曲库还是空的'}
                  description={
                    debouncedKeyword || source || ambientOnly
                      ? '换个关键词或清掉筛选再试试'
                      : '上传第一首 mp3 / m4a，或从 AI 生成的作品里挑一首进来'
                  }
                >
                  {!(debouncedKeyword || source || ambientOnly) && (
                    <Button type="primary" onClick={() => setUploadOpen(true)}>
                      上传音频
                    </Button>
                  )}
                </EmptyState>
              ),
            }}
            pagination={{
              current: page,
              pageSize,
              total,
              showSizeChanger: true,
              pageSizeOptions: [10, 20, 50],
              showTotal: (t) => `共 ${t} 首`,
              onChange: (nextPage, nextSize) => {
                setPage(nextPage);
                setPageSize(nextSize);
              },
            }}
          />
        </div>
      </div>

      {/* 上传弹窗 */}
      <Modal
        open={uploadOpen}
        title="上传音频"
        okText="上传并加入曲库"
        confirmLoading={submitting}
        onOk={() => void submitUpload()}
        onCancel={() => {
          setUploadOpen(false);
          setDraft(emptyDraft());
        }}
        width={640}
        destroyOnClose
      >
        <div className="vc-music__form">
          <div className="vc-music__field vc-music__field--full">
            <label
              className={'vc-music__drop' + (draft.file ? ' vc-music__drop--filled' : '')}
            >
              <input
                type="file"
                accept=".mp3,.m4a,audio/mpeg,audio/mp4"
                hidden
                onChange={(e) => {
                  void onPickFile(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
              <Icon icon={draft.file ? musicIcon : uploadIcon} width={22} />
              {draft.file ? (
                <>
                  <span className="vc-music__file-name">{draft.file.name}</span>
                  <span className="vc-music__sub">
                    {(draft.file.size / 1024 / 1024).toFixed(2)} MB · {formatDuration(draft.durationMs)} ·
                    点击重新选择
                  </span>
                </>
              ) : (
                <>
                  <span>点击选择音频文件（mp3 / m4a）</span>
                  <span className="vc-music__sub">≤ 20MB、≤ 10 分钟；时长由浏览器读取，不上传前不发请求</span>
                </>
              )}
            </label>
          </div>

          <div className="vc-music__field">
            <span className="vc-music__label">标题</span>
            <Input
              maxLength={200}
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder="默认取文件名"
            />
          </div>
          <div className="vc-music__field">
            <span className="vc-music__label">艺人 / 作者</span>
            <Input
              maxLength={200}
              value={draft.artist}
              onChange={(e) => setDraft((d) => ({ ...d, artist: e.target.value }))}
              placeholder="可选"
            />
          </div>
          <div className="vc-music__field">
            <span className="vc-music__label">来源</span>
            <Select
              value={draft.source}
              onChange={(v) => {
                setDraft((d) => ({ ...d, source: v, aiDisclosure: v !== 'UPLOAD' && v !== 'JAMENDO' && v !== 'AIGEI_CC' ? true : d.aiDisclosure }));
              }}
              options={SOURCE_LABELS.map((s) => ({ value: s.value, label: s.label }))}
            />
          </div>
          <div className="vc-music__field">
            <span className="vc-music__label">许可</span>
            <Select
              value={draft.license}
              onChange={(v) => setDraft((d) => ({ ...d, license: v }))}
              options={LICENSE_LABELS.map((l) => ({
                value: l.value,
                label: `${l.label} · ${l.hint}`,
              }))}
            />
          </div>

          {(draft.license === 'CC-BY' || draft.license === 'LICENSED') && (
            <div className="vc-music__field vc-music__field--full">
              <span className="vc-music__label">
                {draft.license === 'CC-BY' ? '署名（必填）' : '授权来源（可选）'}
              </span>
              <Input
                maxLength={500}
                value={draft.attribution}
                onChange={(e) => setDraft((d) => ({ ...d, attribution: e.target.value }))}
                placeholder={draft.license === 'CC-BY' ? '例：原曲作者 / 作品链接 / CC-BY 4.0' : '例：XX 素材站 商用授权'}
              />
            </div>
          )}

          <div className="vc-music__field vc-music__field--full">
            <span className="vc-music__label">AI 生成</span>
            <div className="vc-toolbar" style={{ gap: 8 }}>
              <Switch
                checked={draft.aiDisclosure}
                onChange={(v) => setDraft((d) => ({ ...d, aiDisclosure: v }))}
              />
              {draft.aiDisclosure && (
                <Input
                  style={{ flex: 1 }}
                  maxLength={100}
                  value={draft.aiModel}
                  onChange={(e) => setDraft((d) => ({ ...d, aiModel: e.target.value }))}
                  placeholder="模型标识（必填），例：acestep-v15-turbo"
                />
              )}
            </div>
            <p className="vc-music__hint">AI 生成的作品会在列表与播放器上显示「AI 生成」标识。</p>
          </div>

          <div className="vc-music__field vc-music__field--full">
            <span className="vc-music__label">标签</span>
            <Input
              value={draft.tagsText}
              onChange={(e) => setDraft((d) => ({ ...d, tagsText: e.target.value }))}
              placeholder="用逗号或空格分隔，最多 8 个"
            />
          </div>
        </div>
      </Modal>

      {/* 编辑弹窗 */}
      <Modal
        open={!!editing}
        title={`编辑《${editing?.title ?? ''}》`}
        okText="保存"
        confirmLoading={savingEdit}
        onOk={() => void submitEdit()}
        onCancel={() => setEditing(null)}
        width={640}
        destroyOnClose
      >
        <div className="vc-music__form">
          <div className="vc-music__field">
            <span className="vc-music__label">标题</span>
            <Input
              maxLength={200}
              value={editDraft.title}
              onChange={(e) => setEditDraft((d) => ({ ...d, title: e.target.value }))}
            />
          </div>
          <div className="vc-music__field">
            <span className="vc-music__label">艺人 / 作者</span>
            <Input
              maxLength={200}
              value={editDraft.artist}
              onChange={(e) => setEditDraft((d) => ({ ...d, artist: e.target.value }))}
            />
          </div>
          <div className="vc-music__field">
            <span className="vc-music__label">来源</span>
            <Select
              value={editDraft.source}
              onChange={(v) => setEditDraft((d) => ({ ...d, source: v }))}
              options={SOURCE_LABELS.map((s) => ({ value: s.value, label: s.label }))}
            />
          </div>
          <div className="vc-music__field">
            <span className="vc-music__label">许可</span>
            <Select
              value={editDraft.license}
              onChange={(v) => setEditDraft((d) => ({ ...d, license: v }))}
              options={LICENSE_LABELS.map((l) => ({ value: l.value, label: l.label }))}
            />
          </div>
          <div className="vc-music__field vc-music__field--full">
            <span className="vc-music__label">署名 / 授权来源</span>
            <Input
              maxLength={500}
              value={editDraft.attribution}
              onChange={(e) => setEditDraft((d) => ({ ...d, attribution: e.target.value }))}
              placeholder={editDraft.license === 'CC-BY' ? 'CC-BY 必填：作者 / 作品链接' : '可选'}
            />
          </div>
          <div className="vc-music__field vc-music__field--full">
            <span className="vc-music__label">AI 生成</span>
            <div className="vc-toolbar" style={{ gap: 8 }}>
              <Switch
                checked={editDraft.aiDisclosure}
                onChange={(v) => setEditDraft((d) => ({ ...d, aiDisclosure: v }))}
              />
              {editDraft.aiDisclosure && (
                <Input
                  style={{ flex: 1 }}
                  maxLength={100}
                  value={editDraft.aiModel}
                  onChange={(e) => setEditDraft((d) => ({ ...d, aiModel: e.target.value }))}
                  placeholder="模型标识（必填）"
                />
              )}
            </div>
          </div>
          <div className="vc-music__field vc-music__field--full">
            <span className="vc-music__label">标签</span>
            <Input
              value={editDraft.tagsText}
              onChange={(e) => setEditDraft((d) => ({ ...d, tagsText: e.target.value }))}
              placeholder="用逗号或空格分隔，最多 8 个"
            />
          </div>
          {editing?.status === 'hidden' && (
            <p className="vc-music__hint vc-music__field--full">
              <Icon icon={alertIcon} width={13} /> 该曲目已下架，不会出现在背景音池。
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default MusicPage;
