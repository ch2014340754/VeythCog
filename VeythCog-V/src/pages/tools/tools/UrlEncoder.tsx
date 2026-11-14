import React from 'react';
import CodecTool from '../components/CodecTool';

const UrlEncoder: React.FC = () => (
  <CodecTool
    title="URL 编解码"
    description="encodeURIComponent / decodeURIComponent"
    options={[
      { value: 'encode', label: '编码', placeholder: '输入 URL 参数或文本', actionLabel: '编码', errorPrefix: '编码失败：' },
      { value: 'decode', label: '解码', placeholder: '输入 %E4%B8%AD%E6%96%87 这种字符串', actionLabel: '解码', errorPrefix: '解码失败：' },
    ]}
    convert={(mode, input) => (mode === 'encode' ? encodeURIComponent(input) : decodeURIComponent(input))}
  />
);

export default UrlEncoder;
