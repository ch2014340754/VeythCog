import React, { useState } from 'react';
import { Button, message } from 'antd';
import { Icon } from '@iconify/react';
import uploadIcon from '@iconify-icons/lucide/upload';
import ToolShell from '../ToolShell';
import { useTheme } from '@/contexts/ThemeContext';

const ImageBase64: React.FC = () => {
  const { colors } = useTheme();
  const [dataUrl, setDataUrl] = useState('');
  const [meta, setMeta] = useState<{ name: string; size: string; dims: string } | null>(null);

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
    <ToolShell title="图片转 Base64" description="拖拽或选择图片，生成 data URL"
      actions={
        <Button size="small" onClick={() => { navigator.clipboard.writeText(dataUrl); message.success('已复制'); }} disabled={!dataUrl}>
          复制 Base64
        </Button>
      }
    >
      <label
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: 48,
          border: `2px dashed ${colors.border}`,
          borderRadius: 'var(--radius-lg)',
          cursor: 'pointer',
          color: colors.textSecondary,
          marginBottom: 16,
        }}
      >
        <Icon icon={uploadIcon} width={32} />
        <div style={{ fontSize: 14 }}>点击选择或拖拽图片到这里</div>
        <input
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        />
      </label>
      {meta && (
        <div style={{ marginBottom: 12, fontSize: 13, color: colors.textSecondary }}>
          {meta.name} · {meta.size} · {meta.dims}
        </div>
      )}
      {dataUrl && (
        <>
          <img src={dataUrl} alt="preview" style={{ maxWidth: 320, borderRadius: 8, marginBottom: 12, display: 'block' }} />
          <textarea
            readOnly
            value={dataUrl}
            style={{
              width: '100%',
              minHeight: 100,
              padding: 12,
              fontFamily: "'JetBrains Mono', Consolas, monospace",
              fontSize: 11,
              border: `1px solid ${colors.border}`,
              borderRadius: 8,
              background: colors.surface,
              color: colors.text,
            }}
          />
        </>
      )}
    </ToolShell>
  );
};

export default ImageBase64;
