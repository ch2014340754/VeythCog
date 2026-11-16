/**
 * 音乐库 API。
 *
 * 后端：/api/music（vc-app MusicController）。
 * 曲目下发里 streamUrl 是「接口相对路径 + 播流签名」，这里统一用 apiUrl() 补上后端基址，
 * 因为 <audio src> 只能吃绝对地址，且带不上 Authorization（鉴权靠签名本身）。
 */

import { apiUrl, http, uploadForm } from './client';

export type TrackSource = 'UPLOAD' | 'AI_GEN' | 'JAMENDO' | 'AIGEI_CC' | 'AI_OTHER';
export type TrackLicense = 'CC0' | 'CC-BY' | 'OWNED' | 'AI_GEN' | 'LICENSED';
export type TrackStatus = 'published' | 'hidden';

export interface MusicTrack {
  id: number;
  title: string;
  artist: string;
  /** 时长（毫秒） */
  durationMs: number;
  /** 封面双色渐变；后端缺失时会按标题兜底 */
  coverColor: string[];
  source: TrackSource;
  license: TrackLicense;
  attribution: string;
  licenseUrl: string;
  /** AI 生成标识：为 true 时前端必须展示「AI 生成」 */
  aiDisclosure: boolean;
  aiModel: string;
  tags: string[];
  ambientEnabled: boolean;
  ambientOrder: number;
  status: TrackStatus;
  createdAt: number;
  updatedAt: number;
  /** 播流地址（短时签名，绝对地址）；后端异常时可能为空串 */
  streamUrl: string;
}

export interface TrackPage {
  records: MusicTrack[];
  total: number;
  current: number;
  pageSize: number;
}

export interface TrackQuery {
  keyword?: string;
  source?: TrackSource;
  ambientOnly?: boolean;
  tag?: string;
  current?: number;
  pageSize?: number;
  sortField?: 'title' | 'durationMs' | 'createdAt' | 'updatedAt';
  sortOrder?: 'ascend' | 'descend';
}

export interface UploadMeta {
  title?: string;
  artist?: string;
  /** 时长（毫秒），前端读音频 metadata 后提交 */
  durationMs: number;
  source?: TrackSource;
  license?: TrackLicense;
  attribution?: string;
  licenseUrl?: string;
  aiDisclosure?: boolean;
  aiModel?: string;
  tags?: string[];
}

export interface TrackPatch {
  title?: string;
  artist?: string;
  tags?: string[];
  source?: TrackSource;
  license?: TrackLicense;
  attribution?: string;
  licenseUrl?: string;
  aiDisclosure?: boolean;
  aiModel?: string;
  status?: TrackStatus;
}

/** 后端下发的相对播流地址补成绝对地址（<audio> 只能用绝对地址） */
function withAbsoluteStream(track: MusicTrack): MusicTrack {
  if (!track.streamUrl || track.streamUrl.startsWith('http')) return track;
  return { ...track, streamUrl: apiUrl(track.streamUrl) };
}

/** 分页列表 */
export async function listTracks(query: TrackQuery = {}): Promise<TrackPage> {
  const page = await http.get<TrackPage>('/music/tracks', {
    keyword: query.keyword,
    source: query.source,
    ambientOnly: query.ambientOnly ? 'true' : undefined,
    tag: query.tag,
    current: query.current,
    pageSize: query.pageSize,
    sortField: query.sortField,
    sortOrder: query.sortOrder,
  });
  return { ...page, records: (page.records ?? []).map(withAbsoluteStream) };
}

/** 详情 */
export async function getTrack(id: number): Promise<MusicTrack> {
  return withAbsoluteStream(await http.get<MusicTrack>(`/music/tracks/${id}`));
}

/** 背景音池（ambient_order 升序） */
export async function listAmbientTracks(): Promise<MusicTrack[]> {
  const tracks = await http.get<MusicTrack[]>('/music/ambient');
  return (tracks ?? []).map(withAbsoluteStream);
}

/** 上传音频 + 元信息（一次请求完成对象上传与落库） */
export async function uploadTrack(file: File, meta: UploadMeta): Promise<MusicTrack> {
  const form = new FormData();
  form.append('file', file, file.name);
  // meta 用普通文本 field（不要包 Blob）：后端按 @RequestParam 读 multipart 文本 part，
  // 带 application/json 的 part 不会被当成表单文本参数
  form.append('meta', JSON.stringify(meta));
  return withAbsoluteStream(await uploadForm<MusicTrack>('/music/upload', form, 120000));
}

/** 更新元信息（null/省略 字段不改） */
export async function updateTrack(id: number, patch: TrackPatch): Promise<MusicTrack> {
  return withAbsoluteStream(await http.put<MusicTrack>(`/music/tracks/${id}`, patch));
}

/** 启用 / 停用背景音 */
export async function setTrackAmbient(
  id: number,
  enabled: boolean,
  order?: number,
): Promise<MusicTrack> {
  return withAbsoluteStream(await http.put<MusicTrack>(`/music/tracks/${id}/ambient`, { enabled, order }));
}

/** 删除（软删除 + 删对象） */
export async function deleteTrack(id: number): Promise<void> {
  await http.del<void>(`/music/tracks/${id}`);
}

/* ================= 前端本地工具 ================= */

/** 背景音池上限（与后端 music.ambient-max 保持一致；后端仍会兜底校验） */
export const AMBIENT_MAX = 8;

/** 单文件上限 20MB / 时长上限 10 分钟（与后端一致，前端提前拦截避免无谓上传） */
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_DURATION_MS = 600_000;

/** 许可中文说明（上传/编辑弹窗共用） */
export const LICENSE_LABELS: { value: TrackLicense; label: string; hint: string }[] = [
  { value: 'OWNED', label: '自有版权', hint: '自己创作或买断，可自由使用' },
  { value: 'CC0', label: 'CC0 公共领域', hint: '无任何署名要求' },
  { value: 'CC-BY', label: 'CC-BY 署名', hint: '必须填写原作者署名' },
  { value: 'LICENSED', label: '商业授权', hint: '已获授权，填写授权来源' },
  { value: 'AI_GEN', label: 'AI 生成', hint: 'AI 生成作品，需标注模型' },
];

/** 来源中文说明 */
export const SOURCE_LABELS: { value: TrackSource; label: string }[] = [
  { value: 'UPLOAD', label: '本地/原创' },
  { value: 'AI_GEN', label: 'AI 生成' },
  { value: 'JAMENDO', label: 'Jamendo' },
  { value: 'AIGEI_CC', label: '爱给网 CC' },
  { value: 'AI_OTHER', label: 'AI 生成（其他）' },
];

/** 时长格式化 00:00（列表 / 播放器共用） */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * 读本地音频文件时长：不依赖后端（后端不引音频库），用临时 <audio> 读 metadata。
 * 返回毫秒；读不出来时返回 0，由后端按「未知时长」接受。
 */
export function readAudioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    let settled = false;
    const done = (value: number) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      audio.src = '';
      resolve(value);
    };
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      const duration = Number.isFinite(audio.duration) ? Math.round(audio.duration * 1000) : 0;
      done(duration);
    };
    audio.onerror = () => done(0);
    // 个别浏览器 metadata 事件不触发，兜底 5s
    window.setTimeout(() => done(0), 5000);
    audio.src = url;
  });
}
