import React from 'react';
import { Modal, Input, Button, message, Spin } from 'antd';
import {
  createBookmark,
  fetchSiteIcon,
  getBookmarkIcon,
  updateBookmark,
  uploadIcon,
  type BookmarkSaveInput,
  type NavBookmark,
  type NavIconType,
} from '@/api/nav';
import { useNavStore } from '@/stores/navStore';
import { useTheme } from '@/contexts/ThemeContext';
import { getCachedIcon, clearCachedIcon } from '@/utils/iconCache';
import { IconPreview } from './BookmarkIcon';

interface Props {
  open: boolean;
  onClose: () => void;
  /** 编辑模式：传入书签对象；新建模式：传 null */
  editing: NavBookmark | null;
}

/** 预设底色：参照 iTab 色板顺序 */
const PRESET_COLORS = [
  '#4C8DF6', '#FFC53D', '#FF5A5A', '#6B4A3A', '#8BC34A', '#1D3C78',
  '#C9A063', '#3B2C2C', '#E23B3B', '#1E3FAE', '#9EE6C8',
];

const DEFAULT_COLOR = PRESET_COLORS[0];

const MAX_UPLOAD_BYTES = 512 * 1024;
const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'ico'];

const HTTP_URL = /^https?:\/\//i;

function errorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'message' in err) {
    const msg = (err as { message?: unknown }).message;
    if (typeof msg === 'string' && msg.trim()) return msg;
  }
  return fallback;
}

/**
 * 添加 / 编辑书签弹窗（参照 iTab「自定义图标」）。
 *
 * 三种图标来源：
 * - text   文字图标（文字 + 底色，不产生 S3 对象）
 * - upload 自定义上传（选中即上传 S3，保存时只回传 iconKey）
 * - auto   网站图标（「获取图标」抓取站点图标并上传 S3，也支持沿用历史图标）
 */
const BookmarkModal: React.FC<Props> = ({ open, onClose, editing }) => {
  const activeCategoryId = useNavStore((s) => s.activeCategoryId);
  const { colors } = useTheme();

  const [title, setTitle] = React.useState('');
  const [url, setUrl] = React.useState('');
  const [mode, setMode] = React.useState<NavIconType>('auto');
  const [text, setText] = React.useState('A');
  const [color, setColor] = React.useState(DEFAULT_COLOR);

  /** 网站图标（auto）与上传图标（upload）各自的 key / 预览地址，切换模式不丢 */
  const [autoKey, setAutoKey] = React.useState<string | null>(null);
  const [autoUrl, setAutoUrl] = React.useState<string | null>(null);
  const [uploadKey, setUploadKey] = React.useState<string | null>(null);
  const [uploadUrl, setUploadUrl] = React.useState<string | null>(null);

  const [fetching, setFetching] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const colorInputRef = React.useRef<HTMLInputElement>(null);

  // 打开时初始化表单
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const type = editing?.iconType ?? 'auto';
    setMode(type);
    setTitle(editing?.title ?? '');
    setUrl(editing?.url ?? '');
    setText(editing?.iconText || editing?.title?.slice(0, 1) || 'A');
    setColor(editing?.iconColor || DEFAULT_COLOR);
    setAutoKey(type === 'auto' ? editing?.iconKey ?? null : null);
    setUploadKey(type === 'upload' ? editing?.iconKey ?? null : null);
    setAutoUrl(null);
    setUploadUrl(null);

    // 编辑已有图片图标：优先用本地缓存地址，未命中再问后端要 S3 直链
    if (editing && editing.hasIcon && type !== 'text') {
      const cached = getCachedIcon(editing);
      if (cached?.url) {
        if (type === 'auto') setAutoUrl(cached.url);
        else setUploadUrl(cached.url);
      } else {
        getBookmarkIcon(editing.id)
          .then((icon) => {
            if (cancelled || !icon?.url) return;
            if (type === 'auto') setAutoUrl(icon.url);
            else setUploadUrl(icon.url);
          })
          .catch(() => {
            // 预览取不到不影响保存，保存时仍回传 iconKey
          });
      }
    }

    return () => {
      cancelled = true;
    };
  }, [open, editing]);

  const resetForContinue = () => {
    setTitle('');
    setUrl('');
    setMode('auto');
    setText('A');
    setColor(DEFAULT_COLOR);
    setAutoKey(null);
    setAutoUrl(null);
    setUploadKey(null);
    setUploadUrl(null);
  };

  /** 获取网站图标：抓取 + 上传 S3，成功即选中「网站图标」位 */
  const handleFetchIcon = async () => {
    const target = url.trim();
    if (!target) {
      message.warning('请先填写网址');
      return;
    }
    if (!HTTP_URL.test(target)) {
      message.warning('网址需以 http:// 或 https:// 开头');
      return;
    }
    setFetching(true);
    try {
      const result = await fetchSiteIcon(target);
      setAutoKey(result.iconKey);
      setAutoUrl(result.iconUrl);
      setMode('auto');
      if (!title.trim() && result.title) {
        setTitle(result.title.slice(0, 64));
      }
      message.success('已获取网站图标');
    } catch (err) {
      console.error('获取网站图标失败', err);
      message.error(errorMessage(err, '未能获取网站图标，请改用上传图片或文字图标'));
    } finally {
      setFetching(false);
    }
  };

  /** 上传自定义图标：选中文件即上传，成功拿到 iconKey */
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      message.error('仅支持 png / jpg / jpeg / webp / gif / ico');
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      message.error('图标不能超过 512KB');
      return;
    }

    setUploading(true);
    try {
      const result = await uploadIcon(file);
      setUploadKey(result.iconKey);
      setUploadUrl(result.iconUrl);
      setMode('upload');
      if (!title.trim()) {
        setTitle(file.name.replace(/\.\w+$/, '').slice(0, 64));
      }
      message.success('图标已上传');
    } catch (err) {
      console.error('上传图标失败', err);
      message.error(errorMessage(err, '图标上传失败'));
    } finally {
      setUploading(false);
    }
  };

  const save = async (continueAdding: boolean) => {
    const finalTitle = title.trim();
    const finalUrl = url.trim();

    if (!finalTitle) {
      message.warning('请填写名称');
      return;
    }
    if (!finalUrl || !HTTP_URL.test(finalUrl)) {
      message.warning('请填写以 http:// 或 https:// 开头的网址');
      return;
    }
    if (mode === 'text' && !text.trim()) {
      message.warning('请填写图标文字');
      return;
    }
    if (mode === 'upload' && !uploadKey) {
      message.warning('请先上传图标图片');
      return;
    }

    const payload: BookmarkSaveInput = {
      title: finalTitle,
      url: finalUrl,
      iconType: mode,
      iconKey: mode === 'upload' ? uploadKey : mode === 'auto' ? autoKey : null,
      iconText: mode === 'text' ? text.trim() : null,
      iconColor: mode === 'text' ? color : null,
    };

    setSaving(true);
    try {
      if (editing) {
        await updateBookmark(editing.id, { ...payload, categoryId: editing.categoryId });
        clearCachedIcon(editing.id);
      } else {
        if (!activeCategoryId) {
          message.error('请先选择分类');
          return;
        }
        const createdId = await createBookmark({ ...payload, categoryId: activeCategoryId });
        if (createdId) clearCachedIcon(createdId);
      }

      message.success(editing ? '书签已更新' : '书签已添加');
      const { activeCategoryId: cid, loadBookmarks } = useNavStore.getState();
      if (cid) loadBookmarks(cid);

      if (continueAdding && !editing) {
        resetForContinue();
      } else {
        onClose();
      }
    } catch (err) {
      console.error('保存书签失败', err);
      message.error(errorMessage(err, '保存失败'));
    } finally {
      setSaving(false);
    }
  };

  const selectedRing = `0 0 0 2px ${colors.primary}`;
  const tileStyle = (selected: boolean): React.CSSProperties => ({
    width: 66,
    height: 66,
    borderRadius: 14,
    border: `1px solid ${selected ? colors.primary : colors.divider}`,
    background: selected ? colors.primary10 : colors.surfaceElevated,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    position: 'relative',
    padding: 6,
    boxSizing: 'border-box',
  });

  const labelStyle: React.CSSProperties = {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 1.2,
  };

  const fieldLabel: React.CSSProperties = {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 8,
  };

  const cardStyle: React.CSSProperties = {
    background: colors.surface,
    borderRadius: 16,
    border: `1px solid ${colors.divider}`,
    padding: '18px 20px',
  };

  const hasAutoTile = !!autoUrl;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={560}
      title={
        <div>
          <div style={{ fontSize: 18, fontWeight: 600, color: colors.text }}>自定义图标</div>
          <div style={{ fontSize: 12, color: colors.textTertiary, marginTop: 4, fontWeight: 400 }}>
            自定义 VeythCog 桌面图标内容
          </div>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 }}>
        {/* 卡片 1：网址 / 名称 */}
        <div style={cardStyle}>
          <div style={{ marginBottom: 14 }}>
            <div style={fieldLabel}>网址</div>
            <Input
              placeholder="https://"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              size="large"
              variant="filled"
              prefix={<span style={{ color: colors.textTertiary, marginRight: 2 }}>🔗</span>}
              suffix={
                <Button
                  type="text"
                  size="small"
                  loading={fetching}
                  onClick={handleFetchIcon}
                  style={{ color: colors.primary, fontWeight: 500, paddingInline: 4 }}
                >
                  获取图标
                </Button>
              }
              style={{ borderRadius: 10 }}
            />
          </div>
          <div>
            <div style={fieldLabel}>名称</div>
            <Input
              placeholder="网站名称"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={64}
              size="large"
              variant="filled"
              prefix={<span style={{ color: colors.textTertiary, marginRight: 2 }}>T</span>}
              style={{ borderRadius: 10 }}
            />
          </div>
        </div>

        {/* 卡片 2：图标位 + 文字 / 颜色 */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', gap: 18 }}>
            {/* 文字图标位 */}
            <div>
              <div style={tileStyle(mode === 'text')} onClick={() => setMode('text')}>
                <IconPreview
                  icon={{ type: 'text', text: text || 'A', color }}
                  title={title}
                  size={50}
                  plain
                />
                {mode === 'text' && (
                  <span
                    style={{
                      position: 'absolute',
                      right: 2,
                      bottom: 2,
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      background: colors.primary,
                      color: '#fff',
                      fontSize: 11,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    }}
                  >
                    ✓
                  </span>
                )}
              </div>
              <div style={labelStyle}>文字图标</div>
            </div>

            {/* 上传位 */}
            <div>
              <div style={tileStyle(mode === 'upload')} onClick={() => fileInputRef.current?.click()}>
                {uploading ? (
                  <Spin size="small" />
                ) : uploadUrl ? (
                  <IconPreview
                    icon={{ type: 'upload', url: uploadUrl }}
                    title={title}
                    size={50}
                    plain
                  />
                ) : (
                  <span style={{ fontSize: 24, color: colors.textTertiary, lineHeight: 1 }}>+</span>
                )}
                {mode === 'upload' && uploadUrl && (
                  <span
                    style={{
                      position: 'absolute',
                      right: 2,
                      bottom: 2,
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      background: colors.primary,
                      color: '#fff',
                      fontSize: 11,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    }}
                  >
                    ✓
                  </span>
                )}
              </div>
              <div style={labelStyle}>上传</div>
            </div>

            {/* 网站图标位：获取成功后才出现 */}
            {hasAutoTile && (
              <div>
                <div style={tileStyle(mode === 'auto')} onClick={() => setMode('auto')}>
                  <IconPreview
                    icon={{ type: 'auto', url: autoUrl }}
                    title={title}
                    size={50}
                    plain
                  />
                  {mode === 'auto' && (
                    <span
                      style={{
                        position: 'absolute',
                        right: 2,
                        bottom: 2,
                        width: 18,
                        height: 18,
                        borderRadius: '50%',
                        background: colors.primary,
                        color: '#fff',
                        fontSize: 11,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      }}
                    >
                      ✓
                    </span>
                  )}
                </div>
                <div style={labelStyle}>网站图标</div>
              </div>
            )}
          </div>

          {!hasAutoTile && mode === 'auto' && (
            <div style={{ fontSize: 12, color: colors.textTertiary, marginTop: 8 }}>
              未选择图标时，保存后会自动抓取网站图标
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,image/x-icon,.ico"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />

          {/* 文字图标设置 */}
          <div style={{ marginTop: 18 }}>
            <div style={fieldLabel}>图标文字</div>
            <Input
              value={text}
              onChange={(e) => {
                setText(e.target.value.slice(0, 3));
                if (mode !== 'text') setMode('text');
              }}
              maxLength={3}
              size="large"
              variant="filled"
              placeholder="A"
              prefix={<span style={{ color: colors.textTertiary, marginRight: 2 }}>Tt</span>}
              style={{ borderRadius: 10, maxWidth: 240 }}
            />
          </div>

          <div style={{ marginTop: 18 }}>
            <div style={fieldLabel}>图标颜色</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {PRESET_COLORS.map((preset) => {
                const selected = color.toLowerCase() === preset.toLowerCase();
                return (
                  <button
                    key={preset}
                    type="button"
                    aria-label={preset}
                    onClick={() => {
                      setColor(preset);
                      setMode('text');
                    }}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: preset,
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                      boxShadow: selected ? selectedRing : 'inset 0 0 0 1px rgba(0,0,0,0.06)',
                      transform: selected ? 'scale(1.08)' : 'none',
                      transition: 'transform 0.15s, box-shadow 0.15s',
                    }}
                  />
                );
              })}

              {/* 自定义取色：彩虹圆环 + 原生取色器 */}
              <button
                type="button"
                aria-label="自定义颜色"
                onClick={() => colorInputRef.current?.click()}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  background: 'conic-gradient(#ff5a5a, #ffc53d, #8bc34a, #4c8df6, #9b59d0, #ff5a5a)',
                  boxShadow: !PRESET_COLORS.some((p) => p.toLowerCase() === color.toLowerCase())
                    ? selectedRing
                    : 'inset 0 0 0 1px rgba(0,0,0,0.06)',
                }}
              />
              <input
                ref={colorInputRef}
                type="color"
                value={color}
                onChange={(e) => {
                  setColor(e.target.value);
                  setMode('text');
                }}
                style={{ display: 'none' }}
              />
            </div>
          </div>
        </div>

        {/* 底部按钮 */}
        <div style={{ display: 'flex', gap: 12, paddingTop: 4 }}>
          <Button
            type="primary"
            size="large"
            loading={saving}
            onClick={() => save(false)}
            style={{ borderRadius: 10, height: 44, minWidth: 120, fontWeight: 500 }}
          >
            保存
          </Button>
          {!editing && (
            <Button
              size="large"
              loading={saving}
              onClick={() => save(true)}
              style={{
                borderRadius: 10,
                height: 44,
                minWidth: 120,
                fontWeight: 500,
                color: colors.primary,
                borderColor: colors.primary30,
                background: 'transparent',
              }}
            >
              保存并继续
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default BookmarkModal;
