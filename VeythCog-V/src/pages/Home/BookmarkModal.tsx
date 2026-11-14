import React from 'react';
import { Modal, Input, Button, Form, message, Spin } from 'antd';
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
import { getCachedIcon, clearCachedIcon } from '@/utils/iconCache';
import { IconPreview } from './BookmarkIcon';

interface Props {
  open: boolean;
  onClose: () => void;
  /** 编辑模式：传入书签对象；新建模式：传 null */
  editing: NavBookmark | null;
}

interface BookmarkFormValues {
  title: string;
  url: string;
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
 *
 * 校验：网址 / 名称由 AntD Form rules 负责，错误内联在字段下方；
 * 图标模式不是标准输入，用 iconError 在图标区内联提示。
 *
 * 视觉：vc-modal / vc-form-card / vc-icon-tile / vc-color-dot 统一体系，颜色全部取主题变量。
 */
const BookmarkModal: React.FC<Props> = ({ open, onClose, editing }) => {
  const activeCategoryId = useNavStore((s) => s.activeCategoryId);

  const [form] = Form.useForm<BookmarkFormValues>();
  const title = Form.useWatch('title', form) ?? '';

  const [mode, setMode] = React.useState<NavIconType>('auto');
  const [text, setText] = React.useState('A');
  const [color, setColor] = React.useState(DEFAULT_COLOR);
  const [iconError, setIconError] = React.useState('');

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
    form.resetFields();
    form.setFieldsValue({ title: editing?.title ?? '', url: editing?.url ?? '' });
    setText(editing?.iconText || editing?.title?.slice(0, 1) || 'A');
    setColor(editing?.iconColor || DEFAULT_COLOR);
    setAutoKey(type === 'auto' ? editing?.iconKey ?? null : null);
    setUploadKey(type === 'upload' ? editing?.iconKey ?? null : null);
    setAutoUrl(null);
    setUploadUrl(null);
    setIconError('');

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
  }, [open, editing, form]);

  const resetForContinue = () => {
    form.resetFields();
    form.setFieldsValue({ title: '', url: '' });
    setMode('auto');
    setText('A');
    setColor(DEFAULT_COLOR);
    setAutoKey(null);
    setAutoUrl(null);
    setUploadKey(null);
    setUploadUrl(null);
    setIconError('');
  };

  /** 获取网站图标：先校验网址字段，再抓取 + 上传 S3，成功即选中「网站图标」位 */
  const handleFetchIcon = async () => {
    let values: BookmarkFormValues;
    try {
      values = await form.validateFields(['url']);
    } catch {
      return; // 错误已由 Form.Item 内联展示
    }
    const target = values.url.trim();

    setFetching(true);
    try {
      const result = await fetchSiteIcon(target);
      setAutoKey(result.iconKey);
      setAutoUrl(result.iconUrl);
      setMode('auto');
      setIconError('');
      if (!form.getFieldValue('title')?.trim() && result.title) {
        form.setFieldsValue({ title: result.title.slice(0, 64) });
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
      setIconError('仅支持 png / jpg / jpeg / webp / gif / ico');
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setIconError('图标不能超过 512KB');
      return;
    }

    setUploading(true);
    setIconError('');
    try {
      const result = await uploadIcon(file);
      setUploadKey(result.iconKey);
      setUploadUrl(result.iconUrl);
      setMode('upload');
      if (!form.getFieldValue('title')?.trim()) {
        form.setFieldsValue({ title: file.name.replace(/\.\w+$/, '').slice(0, 64) });
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
    let values: BookmarkFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return; // 必填/格式错误已内联展示
    }

    const finalTitle = values.title.trim();
    const finalUrl = values.url.trim();

    if (mode === 'text' && !text.trim()) {
      setIconError('请填写图标文字');
      return;
    }
    if (mode === 'upload' && !uploadKey) {
      setIconError('请先上传图标图片');
      return;
    }
    setIconError('');

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

  const hasAutoTile = !!autoUrl;
  const customColor = !PRESET_COLORS.some((p) => p.toLowerCase() === color.toLowerCase());

  return (
    <Modal
      rootClassName="vc-modal"
      open={open}
      onCancel={onClose}
      footer={null}
      width={560}
      title={
        <div>
          <div className="vc-modal-head__title">自定义图标</div>
          <div className="vc-modal-head__sub">自定义 VeythCog 桌面图标内容</div>
        </div>
      }
    >
      <div className="vc-stack">
        {/* 卡片 1：网址 / 名称 */}
        <div className="vc-form-card">
          <Form form={form} layout="vertical" requiredMark={false} className="vc-bookmark-form">
            <div className="vc-field-label">网址</div>
            <Form.Item
              name="url"
              style={{ marginBottom: 0 }}
              rules={[
                { required: true, whitespace: true, message: '请填写网址' },
                { pattern: HTTP_URL, message: '网址需以 http:// 或 https:// 开头' },
              ]}
            >
              <Input
                placeholder="https://"
                size="large"
                variant="filled"
                prefix={<span className="vc-note">🔗</span>}
                suffix={
                  <Button type="text" size="small" loading={fetching} onClick={handleFetchIcon}>
                    获取图标
                  </Button>
                }
              />
            </Form.Item>
            <div className="vc-field-label" style={{ marginTop: 16 }}>
              名称
            </div>
            <Form.Item
              name="title"
              style={{ marginBottom: 0 }}
              rules={[
                { required: true, whitespace: true, message: '请填写名称' },
                { max: 64, message: '名称最多 64 个字符' },
              ]}
            >
              <Input
                placeholder="网站名称"
                maxLength={64}
                size="large"
                variant="filled"
                prefix={<span className="vc-note">T</span>}
              />
            </Form.Item>
          </Form>
        </div>

        {/* 卡片 2：图标位 + 文字 / 颜色 */}
        <div className="vc-form-card">
          <div style={{ display: 'flex', gap: 18 }}>
            {/* 文字图标位 */}
            <div>
              <button
                type="button"
                className={'vc-icon-tile' + (mode === 'text' ? ' is-active' : '')}
                onClick={() => {
                  setMode('text');
                  setIconError('');
                }}
                aria-pressed={mode === 'text'}
              >
                <IconPreview icon={{ type: 'text', text: text || 'A', color }} title={title} size={50} plain />
                {mode === 'text' && <span className="vc-icon-tile__check">✓</span>}
              </button>
              <div className="vc-icon-tile-label">文字图标</div>
            </div>

            {/* 上传位 */}
            <div>
              <button
                type="button"
                className={'vc-icon-tile' + (mode === 'upload' ? ' is-active' : '')}
                onClick={() => fileInputRef.current?.click()}
                aria-pressed={mode === 'upload'}
              >
                {uploading ? (
                  <Spin size="small" />
                ) : uploadUrl ? (
                  <IconPreview icon={{ type: 'upload', url: uploadUrl }} title={title} size={50} plain />
                ) : (
                  <span className="vc-icon-tile__plus">+</span>
                )}
                {mode === 'upload' && uploadUrl && <span className="vc-icon-tile__check">✓</span>}
              </button>
              <div className="vc-icon-tile-label">上传</div>
            </div>

            {/* 网站图标位：获取成功后才出现 */}
            {hasAutoTile && (
              <div>
                <button
                  type="button"
                  className={'vc-icon-tile' + (mode === 'auto' ? ' is-active' : '')}
                  onClick={() => {
                    setMode('auto');
                    setIconError('');
                  }}
                  aria-pressed={mode === 'auto'}
                >
                  <IconPreview icon={{ type: 'auto', url: autoUrl }} title={title} size={50} plain />
                  {mode === 'auto' && <span className="vc-icon-tile__check">✓</span>}
                </button>
                <div className="vc-icon-tile-label">网站图标</div>
              </div>
            )}
          </div>

          {!hasAutoTile && mode === 'auto' && (
            <div className="vc-hint" style={{ marginTop: 8 }}>
              未选择图标时，保存后会自动抓取网站图标
            </div>
          )}

          {iconError && (
            <div className="vc-field-error" role="alert">
              {iconError}
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
          <div className="vc-field-label" style={{ marginTop: 18 }}>
            图标文字
          </div>
          <Input
            value={text}
            onChange={(e) => {
              setText(e.target.value.slice(0, 3));
              setIconError('');
              if (mode !== 'text') setMode('text');
            }}
            maxLength={3}
            size="large"
            variant="filled"
            placeholder="A"
            prefix={<span className="vc-note">Tt</span>}
            style={{ maxWidth: 240 }}
          />

          <div className="vc-field-label" style={{ marginTop: 18 }}>
            图标颜色
          </div>
          <div className="vc-color-dots">
            {PRESET_COLORS.map((preset) => {
              const selected = color.toLowerCase() === preset.toLowerCase();
              return (
                <button
                  key={preset}
                  type="button"
                  aria-label={preset}
                  className={'vc-color-dot' + (selected ? ' is-active' : '')}
                  style={{ background: preset }}
                  onClick={() => {
                    setColor(preset);
                    setMode('text');
                    setIconError('');
                  }}
                />
              );
            })}

            {/* 自定义取色：彩虹圆环 + 原生取色器 */}
            <button
              type="button"
              aria-label="自定义颜色"
              className={'vc-color-dot vc-color-dot--custom' + (customColor ? ' is-active' : '')}
              onClick={() => colorInputRef.current?.click()}
            />
            <input
              ref={colorInputRef}
              type="color"
              value={color}
              onChange={(e) => {
                setColor(e.target.value);
                setMode('text');
                setIconError('');
              }}
              style={{ display: 'none' }}
            />
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="vc-modal-foot">
          <Button type="primary" size="large" loading={saving} onClick={() => save(false)} style={{ minWidth: 120 }}>
            保存
          </Button>
          {!editing && (
            <Button size="large" loading={saving} onClick={() => save(true)} style={{ minWidth: 120 }}>
              保存并继续
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default BookmarkModal;
