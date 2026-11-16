import { AMBIENT_MAX, listTracks } from '@/api/music';
import { mockAsPlayerTracks } from '@/mock/music';
import { useModeStore } from '@/stores/modeStore';
import { useMusicStore } from '@/stores/musicStore';
import listMusicIcon from '@iconify-icons/lucide/list-music';
import playIcon from '@iconify-icons/lucide/play';
import searchIcon from '@iconify-icons/lucide/search';
import { Icon } from '@iconify/react';
import { Button, Input, Modal } from 'antd';
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

/** 歌单行：曲库曲目与联调 mock 收敛成同一形状 */
interface PickerRow {
  id: number | string;
  title: string;
  artist: string;
  cover: [string, string];
  durationSec: number;
  ai: boolean;
  ambient: boolean;
}

const FALLBACK_COVER: [string, string] = ['#7C3AED', '#06B6D4'];
/** 列表超过这个时间就顺手静默刷一次（播放器也会 3 分钟轮询，这里只是兜底） */
const STALE_MS = 60_000;

function formatSec(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '--:--';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * 歌单弹窗：首页底部 Dock「歌单」入口打开，列出当前曲库，点一首直接播放。
 *
 * 数据源与播放器同源（`musicStore.tracks`），不在弹窗里另存一份队列；
 * 点歌只发 `requestPlay(id)` 信号，真正的换源/渐入由全局播放器统一处理，
 * 所以弹窗关掉、页面切走，播放都不会中断。
 */
const MusicPickerModal: React.FC = () => {
  const pickerOpen = useMusicStore((s) => s.pickerOpen);
  const setPickerOpen = useMusicStore((s) => s.setPickerOpen);
  const requestPlay = useMusicStore((s) => s.requestPlay);
  /** 点歌后把播放器展开，让用户能直接看到进度并暂停/切歌 */
  const openPlayer = useMusicStore((s) => s.open);
  const tracks = useMusicStore((s) => s.tracks);
  const ambientOn = useMusicStore((s) => s.ambientOn);
  const currentId = useMusicStore((s) => s.currentId);
  const bypass = useModeStore((s) => s.bypassMode);
  const navigate = useNavigate();

  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);

  // 打开时按需静默拉取：已有列表且不旧就直接用，避免每次开弹窗都闪一下
  useEffect(() => {
    if (!pickerOpen) return;
    if (bypass) return;
    const state = useMusicStore.getState();
    const stale = Date.now() - state.tracksLoadedAt > STALE_MS;
    if (state.tracks.length > 0 && !stale) return;
    let cancelled = false;
    setLoading(true);
    listTracks({ pageSize: 200, sortField: 'createdAt', sortOrder: 'descend' })
      .then((page) => {
        if (!cancelled) useMusicStore.getState().setTracks(page.records);
      })
      .catch(() => {
        /* 静默：拉不到就保留旧列表，弹窗里照旧能播已缓存的 */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pickerOpen, bypass]);

  // 关闭时清掉搜索词，下次打开是干净的全量列表
  useEffect(() => {
    if (!pickerOpen) setKeyword('');
  }, [pickerOpen]);

  const rows = useMemo<PickerRow[]>(() => {
    if (bypass) {
      return mockAsPlayerTracks().map((t) => ({
        id: t.id,
        title: t.title,
        artist: t.artist,
        cover: t.cover,
        durationSec: t.durationSec,
        ai: false,
        ambient: false,
      }));
    }
    return tracks.map((t) => ({
      id: t.id,
      title: t.title,
      artist: t.artist || '未知艺人',
      cover:
        t.coverColor && t.coverColor.length >= 2
          ? [t.coverColor[0], t.coverColor[1]]
          : FALLBACK_COVER,
      durationSec: Math.round((t.durationMs || 0) / 1000),
      ai: t.aiDisclosure,
      ambient: t.ambientEnabled,
    }));
  }, [bypass, tracks]);

  const filtered = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    if (!k) return rows;
    return rows.filter(
      (r) => r.title.toLowerCase().includes(k) || r.artist.toLowerCase().includes(k),
    );
  }, [rows, keyword]);

  const ambientCount = useMemo(() => rows.filter((r) => r.ambient).length, [rows]);

  const play = (row: PickerRow) => {
    requestPlay(row.id);
    setPickerOpen(false);
    openPlayer();
  };

  const goLibrary = () => {
    setPickerOpen(false);
    navigate('/music');
  };

  return (
    <Modal
      open={pickerOpen}
      onCancel={() => setPickerOpen(false)}
      footer={null}
      width={560}
      centered
      destroyOnClose={false}
      rootClassName="vc-picker-modal"
      styles={{
        content: { padding: 0, borderRadius: 'var(--radius-lg)', overflow: 'hidden' },
        body: { padding: 0 },
        header: { display: 'none' },
      }}
    >
      <div className="vc-picker">
        <div className="vc-picker__head">
          <div className="vc-picker__heading">
            <div className="vc-picker__title">
              <Icon icon={listMusicIcon} width={18} />
              歌单
            </div>
            <div className="vc-picker__sub">
              {rows.length} 首 · 点一首直接播放
              {ambientOn ? ' · 背景音播放中' : ''}
            </div>
          </div>
          <Input
            allowClear
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            prefix={<Icon icon={searchIcon} width={16} />}
            placeholder="搜索曲名 / 艺人"
            className="vc-picker__search"
          />
        </div>

        <div className="vc-picker__list">
          {loading && rows.length === 0 && <div className="vc-picker__tip">正在加载曲库…</div>}
          {!loading && rows.length === 0 && (
            <div className="vc-picker__empty">
              <div className="vc-picker__empty-title">曲库还没有歌</div>
              <div className="vc-picker__empty-sub">支持 mp3 / m4a，单个 ≤20MB、≤10 分钟</div>
              <Button type="primary" onClick={goLibrary}>
                去音乐库上传
              </Button>
            </div>
          )}
          {rows.length > 0 && filtered.length === 0 && (
            <div className="vc-picker__tip">没有匹配「{keyword.trim()}」的曲目</div>
          )}
          {filtered.map((row) => {
            const active = currentId !== null && String(currentId) === String(row.id);
            return (
              <button
                type="button"
                key={row.id}
                className={'vc-picker__item' + (active ? ' is-current' : '')}
                onClick={() => play(row)}
                title={`播放 ${row.title}`}
              >
                <div
                  className="vc-picker__cover"
                  style={{ background: `linear-gradient(135deg, ${row.cover[0]}, ${row.cover[1]})` }}
                >
                  {row.title.charAt(0)}
                </div>
                <div className="vc-picker__meta">
                  <div className="vc-picker__name">
                    <span className="vc-picker__name-text">{row.title}</span>
                    {row.ai && <span className="vc-picker__badge">AI</span>}
                    {row.ambient && (
                      <span className="vc-picker__badge vc-picker__badge--ambient">背景音</span>
                    )}
                    {active && <span className="vc-picker__badge vc-picker__badge--now">正在播放</span>}
                  </div>
                  <div className="vc-picker__artist">{row.artist}</div>
                </div>
                <div className="vc-picker__dur">{formatSec(row.durationSec)}</div>
                <span className="vc-picker__play">
                  <Icon icon={playIcon} width={16} />
                </span>
              </button>
            );
          })}
        </div>

        <div className="vc-picker__foot">
          <span className="vc-picker__foot-info">
            背景音池 {ambientCount}/{AMBIENT_MAX}
          </span>
          <Button type="link" size="small" onClick={goLibrary}>
            打开音乐库管理
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default MusicPickerModal;
