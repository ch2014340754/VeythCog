/**
 * 剪藏令牌面板（设置 → 账号）
 * ------------------------------------------------------------
 * 令牌是"只可写"的长期凭据：只能调 /clip/capture，不能读列表、不能删改，随时可撤销。
 * 明文与书签脚本只在签发的那一次响应里出现 —— 想换设备就再签一枚，别复用同一枚。
 */
import React from 'react';
import { Button, Empty, Input, message, Popconfirm, Tag, Tooltip } from 'antd';
import { Icon } from '@iconify/react';
import infoIcon from '@iconify-icons/lucide/info';
import { createClipToken, listClipTokens, revokeClipToken, type ClipTokenCreateResult, type ClipTokenView } from '@/api/clip';
import '@/styles/clipToken.css';

const fmt = (ts?: number | null) => {
  if (!ts) return '—';
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const ClipTokenPanel: React.FC = () => {
  const [tokens, setTokens] = React.useState<ClipTokenView[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [label, setLabel] = React.useState('');
  const [creating, setCreating] = React.useState(false);
  const [fresh, setFresh] = React.useState<ClipTokenCreateResult | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const list = await listClipTokens();
      setTokens(Array.isArray(list) ? list : []);
    } catch (e) {
      message.error((e as Error).message || '令牌列表加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    setCreating(true);
    try {
      const result = await createClipToken(label.trim() || '默认书签');
      setFresh(result);
      setLabel('');
      await load();
      message.success('令牌已生成，明文只显示这一次');
    } catch (e) {
      message.error((e as Error).message || '生成失败');
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (id: number) => {
    try {
      await revokeClipToken(id);
      message.success('已撤销，该令牌立即失效');
      if (fresh?.id === id) setFresh(null);
      await load();
    } catch (e) {
      message.error((e as Error).message || '撤销失败');
    }
  };

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text).then(
      () => message.success('已复制'),
      () => message.error('复制失败，请手动选中复制'),
    );
  };

  return (
    <section className="vc-panel">
      <div className="vc-panel__head">
        <div>
          <h2 className="vc-panel__title vc-token-title">
            网页剪藏令牌
            <Tooltip
              placement="right"
              title={
                <ul className="vc-token-tip-list">
                  <li>令牌只可写入、不可读取，随时可撤销。</li>
                  <li>令牌是长期凭据（不像登录态会过期），建议每台设备一枚，丢了只撤那一枚。</li>
                  <li>书签脚本会把当前页面的正文发到收件箱，正文只存在你自己的账号里。</li>
                  <li>剪藏是「先收起来」，是否进知识库由你在收件箱里逐条确认。</li>
                </ul>
              }
            >
              <span className="vc-token-tip" aria-label="关于网页剪藏令牌">
                <Icon icon={infoIcon} width={15} />
              </span>
            </Tooltip>
          </h2>
        </div>
      </div>

      <div className="vc-token-create">
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="给这枚令牌起个名字，如：公司电脑 Chrome"
          maxLength={60}
          onPressEnter={() => void create()}
        />
        <Button type="primary" loading={creating} onClick={() => void create()}>
          生成令牌
        </Button>
      </div>

      {fresh && (
        <div className="vc-token-fresh">
          <div className="vc-token-fresh__head">
            <span>刚生成的令牌（{fresh.label}）</span>
            <Tag color="red">只显示这一次</Tag>
          </div>
          <div className="vc-token-fresh__row">
            <Input value={fresh.token} readOnly />
            <Button onClick={() => copy(fresh.token)}>复制令牌</Button>
          </div>
          <div className="vc-token-fresh__row">
            <Input value={fresh.bookmarklet} readOnly />
            <Button onClick={() => copy(fresh.bookmarklet)}>复制脚本</Button>
          </div>
          <div className="vc-token-fresh__drag">
            <a
              href={fresh.bookmarklet}
              className="vc-token-drag"
              draggable
              onClick={(e) => {
                // 点击会试图在"当前页面"执行脚本（会被拦），这里只提示拖拽
                e.preventDefault();
                message.info('把这块拖到浏览器书签栏即可；点击本身不会执行');
              }}
              title="拖我到浏览器书签栏"
            >
              渡思剪藏
            </a>
            <span>↑ 拖到书签栏；之后的任意网页点它一次，就把正文收进收件箱。</span>
          </div>
        </div>
      )}

      {loading && tokens.length === 0 ? (
        <div className="vc-token-empty">正在读取…</div>
      ) : tokens.length === 0 ? (
        <Empty description="还没有令牌：先生成一枚，再把书签拖到书签栏" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <table className="vc-token-table">
          <thead>
            <tr>
              <th>名称</th>
              <th>创建</th>
              <th>最近使用</th>
              <th>状态</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {tokens.map((token) => (
              <tr key={token.id} className={token.revoked ? 'is-revoked' : undefined}>
                <td>{token.label}</td>
                <td>{fmt(token.createdAt)}</td>
                <td>{fmt(token.lastUsedAt)}</td>
                <td>{token.revoked ? <Tag>已撤销</Tag> : <Tag color="green">有效</Tag>}</td>
                <td className="vc-token-table__ops">
                  {!token.revoked && (
                    <Popconfirm
                      title="撤销这枚令牌？"
                      description="撤销后对应的书签立即失效，需要重新生成"
                      okText="撤销"
                      cancelText="取消"
                      okButtonProps={{ danger: true }}
                      onConfirm={() => void revoke(token.id)}
                    >
                      <Button size="small" type="text" danger>
                        撤销
                      </Button>
                    </Popconfirm>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
};

export default ClipTokenPanel;
