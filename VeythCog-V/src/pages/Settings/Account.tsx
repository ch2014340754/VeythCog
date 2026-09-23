import React, { useState } from 'react';
import { Form, Input, Button, message } from 'antd';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuthStore } from '@/stores/authStore';

const Section: React.FC<{ title: string; desc?: string; children: React.ReactNode }> = ({
  title,
  desc,
  children,
}) => {
  const { colors } = useTheme();
  return (
    <section
      className="glass-panel"
      style={{
        background: colors.surface,
        borderRadius: 'var(--radius-lg)',
        border: `1px solid ${colors.border}`,
        padding: 24,
        marginBottom: 20,
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 600, color: colors.text, marginBottom: 4 }}>
        {title}
      </div>
      {desc && (
        <div style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 20 }}>{desc}</div>
      )}
      {children}
    </section>
  );
};

const AccountPage: React.FC = () => {
  const { colors } = useTheme();
  const { user, updateProfile } = useAuthStore();

  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [savingProfile, setSavingProfile] = useState(false);

  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [savingPwd, setSavingPwd] = useState(false);

  const initial = (user?.name ?? '?').trim().charAt(0).toUpperCase();

  const onSaveProfile = async () => {
    if (!name.trim()) {
      message.warning('昵称不能为空');
      return;
    }
    setSavingProfile(true);
    await new Promise((r) => setTimeout(r, 300));
    updateProfile({ name: name.trim(), email: email.trim() || undefined });
    setSavingProfile(false);
    message.success('账号信息已保存');
  };

  const onChangePwd = async () => {
    if (!newPwd) {
      message.warning('请输入新密码');
      return;
    }
    if (newPwd !== confirmPwd) {
      message.warning('两次输入的新密码不一致');
      return;
    }
    setSavingPwd(true);
    await new Promise((r) => setTimeout(r, 300));
    setSavingPwd(false);
    setOldPwd('');
    setNewPwd('');
    setConfirmPwd('');
    message.success('密码已更新（mock）');
  };

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: colors.text, margin: '0 0 20px' }}>
        账号设置
      </h2>

      <Section title="基本信息" desc="修改你的显示名和联系邮箱">
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: colors.primary,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 26,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {initial}
          </div>
          <div style={{ fontSize: 13, color: colors.textSecondary }}>
            头像将取昵称为首字母，后续可上传自定义头像
          </div>
        </div>
        <Form layout="vertical">
          <Form.Item label="昵称">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="你的昵称" />
          </Form.Item>
          <Form.Item label="邮箱" style={{ marginBottom: 20 }}>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </Form.Item>
          <Button type="primary" loading={savingProfile} onClick={onSaveProfile}>
            保存
          </Button>
        </Form>
      </Section>

      <Section title="修改密码" desc="mock 阶段仅前端校验，不会真正变更服务端密码">
        <Form layout="vertical">
          <Form.Item label="当前密码">
            <Input.Password value={oldPwd} onChange={(e) => setOldPwd(e.target.value)} />
          </Form.Item>
          <Form.Item label="新密码">
            <Input.Password value={newPwd} onChange={(e) => setNewPwd(e.target.value)} />
          </Form.Item>
          <Form.Item label="确认新密码" style={{ marginBottom: 20 }}>
            <Input.Password value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} onPressEnter={onChangePwd} />
          </Form.Item>
          <Button type="primary" loading={savingPwd} onClick={onChangePwd}>
            更新密码
          </Button>
        </Form>
      </Section>
    </div>
  );
};

export default AccountPage;
