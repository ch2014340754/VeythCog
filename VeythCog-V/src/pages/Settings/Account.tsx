import { fetchMe, removeAvatar, uploadAvatar } from '@/api/auth';
import PageHeader from '@/components/PageHeader';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuthStore } from '@/stores/authStore';
import { Button, Form, Input, message } from 'antd';
import React, { useEffect, useRef, useState } from 'react';

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
  const [pwdExpanded, setPwdExpanded] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const avatarTouchedRef = useRef(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [removingAvatar, setRemovingAvatar] = useState(false);
  const [avatarBroken, setAvatarBroken] = useState(false);

  const initial = (user?.name ?? '?').trim().charAt(0).toUpperCase();
  const avatarUrl = user?.avatar;

  useEffect(() => {
    setAvatarBroken(false);
  }, [avatarUrl]);

  // 刷新页面后从后端补一次头像，兼容登录前已经持久化的旧用户数据
  useEffect(() => {
    let alive = true;
    fetchMe()
      .then((u) => {
        if (alive && u && !avatarTouchedRef.current) updateProfile({ avatar: u.avatar });
      })
      .catch(() => {
        // 后端不可用 / 旧版本没有 /auth/me：保留本地状态即可
      });
    return () => {
      alive = false;
    };
  }, [updateProfile]);

  const onAvatarSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const typeOk = !file.type || /^image\/(png|jpeg|jpg|webp)$/i.test(file.type);
    if (!typeOk) {
      message.error('仅支持 PNG / JPG / WebP 图片');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      message.error('头像不能超过 2MB');
      return;
    }

    setUploadingAvatar(true);
    avatarTouchedRef.current = true;
    try {
      const result = await uploadAvatar(file);
      updateProfile({ avatar: result.avatarUrl });
      setAvatarBroken(false);
      message.success('头像已更新');
    } catch (err) {
      message.error(err instanceof Error ? err.message : '头像上传失败，请稍后重试');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const onRemoveAvatar = async () => {
    setRemovingAvatar(true);
    avatarTouchedRef.current = true;
    try {
      await removeAvatar();
      updateProfile({ avatar: undefined });
      message.success('已恢复默认头像');
    } catch (err) {
      message.error(err instanceof Error ? err.message : '恢复默认头像失败');
    } finally {
      setRemovingAvatar(false);
    }
  };

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
    setPwdExpanded(false);
    message.success('密码已更新（mock）');
  };

  const onCancelPwd = () => {
    setOldPwd('');
    setNewPwd('');
    setConfirmPwd('');
    setPwdExpanded(false);
  };

  return (
    <div>
      <PageHeader title="账号设置" />

      <div className="vc-stack">
        <section className="vc-panel">
          <div className="vc-panel__head">
            <div>
              <h2 className="vc-panel__title">基本信息</h2>
              <p className="vc-panel__desc">修改头像、显示名和联系邮箱</p>
            </div>
          </div>

          <div className="vc-account-avatar">
            <div className="vc-account-avatar__img" style={{ background: colors.primary, color: colors.textInverse }}>
              {avatarUrl && !avatarBroken ? (
                <img src={avatarUrl} alt="用户头像" onError={() => setAvatarBroken(true)} />
              ) : (
                initial
              )}
              {uploadingAvatar && <div className="vc-account-avatar__mask">上传中</div>}
            </div>
            <div className="vc-account-avatar__side">
              <div className="vc-meta">支持 PNG / JPG / WebP，不超过 2MB；建议使用 1:1 正方形图片</div>
              <div className="vc-toolbar">
                <Button
                  size="small"
                  loading={uploadingAvatar}
                  disabled={removingAvatar}
                  onClick={() => avatarInputRef.current?.click()}
                >
                  上传头像
                </Button>
                {avatarUrl && (
                  <Button size="small" loading={removingAvatar} disabled={uploadingAvatar} onClick={onRemoveAvatar}>
                    恢复默认
                  </Button>
                )}
              </div>
            </div>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={onAvatarSelected}
              style={{ display: 'none' }}
            />
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
        </section>

        <section className="vc-panel">
          <div className="vc-panel__head">
            <div>
              <h2 className="vc-panel__title">修改密码</h2>
              <p className="vc-panel__desc">mock 阶段仅前端校验，不会真正变更服务端密码</p>
            </div>
          </div>
          {!pwdExpanded ? (
            <Button type="primary" onClick={() => setPwdExpanded(true)}>
              修改密码
            </Button>
          ) : (
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
              <div className="vc-toolbar">
                <Button type="primary" loading={savingPwd} onClick={onChangePwd}>
                  应用修改
                </Button>
                <Button onClick={onCancelPwd}>取消</Button>
              </div>
            </Form>
          )}
        </section>
      </div>
    </div>
  );
};

export default AccountPage;
