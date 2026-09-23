import React from 'react';
import { Button, Popconfirm, message, Tag } from 'antd';
import { Icon } from '@iconify/react';
import birdIcon from '@iconify-icons/lucide/bird';
import linkIcon from '@iconify-icons/lucide/link';
import unlinkIcon from '@iconify-icons/lucide/unlink';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuthStore } from '@/stores/authStore';

function formatTime(ts?: number): string {
  if (!ts) return '-';
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const LarkBindPage: React.FC = () => {
  const { colors } = useTheme();
  const { lark, bindLark, unbindLark } = useAuthStore();

  const onBind = async () => {
    // mock：模拟跳转飞书 OAuth 后回调，返回假信息
    message.loading({ content: '正在跳转飞书授权…', key: 'lark', duration: 1.2 });
    setTimeout(() => {
      bindLark({
        openId: `ou_mock_${Math.random().toString(36).slice(2, 12)}`,
        name: '飞书用户（mock）',
      });
      message.success({ content: '飞书账号绑定成功（mock）', key: 'lark' });
    }, 1200);
  };

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: colors.text, margin: '0 0 20px' }}>
        飞书账号绑定
      </h2>

      <div
        className="glass-panel"
        style={{
          background: colors.surface,
          borderRadius: 'var(--radius-lg)',
          border: `1px solid ${colors.border}`,
          padding: 32,
        }}
      >
        {lark.bound ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: colors.primary10,
                  color: colors.primary,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 24,
                  flexShrink: 0,
                }}
              >
                <Icon icon={birdIcon} width={28} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16, fontWeight: 600, color: colors.text }}>
                    {lark.name ?? '飞书用户'}
                  </span>
                  <Tag color="success">已绑定</Tag>
                </div>
                <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>
                  Open ID：{lark.openId}
                </div>
                <div style={{ fontSize: 12, color: colors.textSecondary }}>
                  绑定时间：{formatTime(lark.boundAt)}
                </div>
              </div>
            </div>
            <Popconfirm
              title="解除飞书绑定"
              description="解绑后将无法使用飞书相关功能，确定？"
              onConfirm={() => {
                unbindLark();
                message.success('已解除绑定（mock）');
              }}
            >
              <Button danger icon={<Icon icon={unlinkIcon} width={15} />}>
                解除绑定
              </Button>
            </Popconfirm>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                background: colors.primary10,
                color: colors.primary,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
              }}
            >
              <Icon icon={birdIcon} width={36} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: colors.text, marginBottom: 8 }}>
              尚未绑定飞书账号
            </div>
            <div
              style={{
                fontSize: 13,
                color: colors.textSecondary,
                marginBottom: 24,
                maxWidth: 380,
                margin: '0 auto 24px',
              }}
            >
              绑定后可使用飞书笔记同步、文档读取等功能。当前为 mock 阶段，点击按钮模拟授权流程。
            </div>
            <Button
              type="primary"
              icon={<Icon icon={linkIcon} width={15} />}
              onClick={onBind}
              style={{ background: colors.primary, borderColor: colors.primary }}
            >
              绑定飞书账号
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default LarkBindPage;
