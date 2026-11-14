import React from 'react';
import CodecTool from '../components/CodecTool';

function b64encode(str: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(str)));
}
function b64decode(b64: string): string {
  return new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
}

const Base64Tool: React.FC = () => (
  <CodecTool
    title="Base64 编解码"
    description="支持中文，使用 UTF-8"
    options={[
      { value: 'encode', label: '编码', placeholder: '输入要编码的文本', actionLabel: '编码', errorPrefix: '编码失败：' },
      { value: 'decode', label: '解码', placeholder: '输入 Base64 字符串', actionLabel: '解码', errorPrefix: '解码失败：' },
    ]}
    convert={(mode, input) => (mode === 'encode' ? b64encode(input) : b64decode(input))}
  />
);

export default Base64Tool;
