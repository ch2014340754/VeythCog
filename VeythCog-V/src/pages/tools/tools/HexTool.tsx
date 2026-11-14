import React from 'react';
import CodecTool from '../components/CodecTool';

function hexEncode(input: string): string {
  const bytes = new TextEncoder().encode(input);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join(' ');
}

function hexDecode(input: string): string {
  const clean = input.replace(/[\s,]/g, '');
  const bytes = new Uint8Array(clean.match(/.{2}/g)?.map((h) => parseInt(h, 16)) ?? []);
  return new TextDecoder().decode(bytes);
}

const HexTool: React.FC = () => (
  <CodecTool
    title="Hex 编解码"
    description="文本与十六进制互转，支持中文"
    options={[
      { value: 'encode', label: '文本 → Hex', placeholder: '输入文本', actionLabel: '转换', errorPrefix: '转换失败：' },
      { value: 'decode', label: 'Hex → 文本', placeholder: '48 65 6c 6c 6f', actionLabel: '转换', errorPrefix: '转换失败：' },
    ]}
    convert={(mode, input) => (mode === 'encode' ? hexEncode(input) : hexDecode(input))}
  />
);

export default HexTool;
