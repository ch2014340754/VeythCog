import React from 'react';
import { Button, Popconfirm, message, Tag } from 'antd';
import { Icon } from '@iconify/react';
import birdIcon from '@iconify-icons/lucide/bird';
import linkIcon from '@iconify-icons/lucide/link';
import unlinkIcon from '@iconify-icons/lucide/unlink';
import { useAuthStore } from '@/stores/authStore';
import PageHeader from '@/components/PageHeader';

function formatTime(ts?: number): string {
  if (!ts) return '-';
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const LarkBindPage: React.FC = () => {
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
      <PageHeader title="飞书账号绑定" flow={false} />

      <section className="vc-panel">
        {lark.bound ? (
          <div>
            <div className="vc-lark-head">
              <div className="vc-lark-head__icon">
                <Icon icon={birdIcon} width={26} />
              </div>
              <div>
                <div className="vc-toolbar" style={{ gap: 8 }}>
                  <span className="vc-lark-head__name">{lark.name ?? '飞书用户'}</span>
                  <Tag color="success">已绑定</Tag>
                </div>
                <div className="vc-meta" style={{ marginTop: 4 }}>Open ID：{lark.openId}</div>
                <div className="vc-meta">绑定时间：{formatTime(lark.boundAt)}</div>
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
          <div className="vc-state">
            <div className="vc-lark-head__icon vc-lark-head__icon--lg">
              <Icon icon={birdIcon} width={34} />
            </div>
            <div className="vc-state__title">尚未绑定飞书账号</div>
            <div className="vc-state__desc">
              绑定后可使用飞书笔记同步、文档读取等功能。当前为 mock 阶段，点击按钮模拟授权流程。
            </div>
            <Button type="primary" icon={<Icon icon={linkIcon} width={15} />} onClick={onBind}>
              绑定飞书账号
            </Button>
          </div>
        )}
      </section>
    </div>
  );
};

export default LarkBindPage;
