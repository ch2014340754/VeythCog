import React, { useState } from 'react';
import { Button, message } from 'antd';
import { Icon } from '@iconify/react';
import uploadIcon from '@iconify-icons/lucide/upload';
import ToolShell from '../ToolShell';

const ImageBase64: React.FC = () => {
  const [dataUrl, setDataUrl] = useState('');
  const [meta, setMeta] = useState<{ name: string; size: string; dims: string } | null>(null);
  const [dragging, setDragging] = useState(false);

  const onFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      setDataUrl(url);
      const img = new Image();
      img.onload = () => {
        setMeta({
          name: file.name,
          size: file.size > 1024 * 1024
            ? (file.size / 1024 / 1024).toFixed(2) + ' MB'
            : (file.size / 1024).toFixed(1) + ' KB',
          dims: `${img.width} × ${img.height}`,
        });
      };
      img.src = url;
    };
    reader.readAsDataURL(file);
  };

  return (
    <ToolShell
      title="图片转 Base64"
      description="拖拽或选择图片，生成 data URL"
      actions={
        <Button
          type="primary"
          onClick={() => {
            navigator.clipboard.writeText(dataUrl);
            message.success('已复制');
          }}
          disabled={!dataUrl}
        >
          复制 Base64
        </Button>
      }
    >
      <div className="vc-stack">
        <label
          className={'vc-dropzone' + (dragging ? ' is-dragging' : '')}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) onFile(file);
          }}
        >
          <span className="vc-dropzone__icon">
            <Icon icon={uploadIcon} width={24} />
          </span>
          <span className="vc-dropzone__title">点击选择或拖拽图片到这里</span>
          <span className="vc-dropzone__hint">支持 PNG / JPG / WebP / GIF，转换在本地完成</span>
          <input
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
        </label>

        {meta && (
          <div className="vc-meta">
            {meta.name} · {meta.size} · {meta.dims}
          </div>
        )}

        {dataUrl && (
          <div className="vc-grid" style={{ gridTemplateColumns: 'minmax(0, 320px) minmax(0, 1fr)', alignItems: 'start' }}>
            <div className="vc-panel" style={{ padding: 'var(--space-md)' }}>
              <img src={dataUrl} alt="preview" className="vc-img-preview" />
            </div>
            <div className="vc-tool-pane" style={{ minHeight: 220 }}>
              <div className="vc-tool-pane__head">
                <span className="vc-tool-pane__label">Data URL</span>
                <span className="vc-meta">{dataUrl.length.toLocaleString()} 字符</span>
              </div>
              <div className="vc-tool-pane__body">
                <textarea readOnly className="vc-mono-input vc-tool-pane__raw" value={dataUrl} />
              </div>
            </div>
          </div>
        )}
      </div>
    </ToolShell>
  );
};

export default ImageBase64;
