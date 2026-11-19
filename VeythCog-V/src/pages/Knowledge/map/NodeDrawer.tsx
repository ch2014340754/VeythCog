import React, { useEffect, useState } from 'react';
import { Button, message, Spin, Tag } from 'antd';
import { Icon } from '@iconify/react';
import externalLinkIcon from '@iconify-icons/lucide/external-link';
import messageSquareIcon from '@iconify-icons/lucide/message-square';
import xIcon from '@iconify-icons/lucide/x';
import zapIcon from '@iconify-icons/lucide/zap';
import { getDoc, vectorize } from '@/api/knowledge';
import type { GraphNode } from '@/api/graph';

export interface NodeRelation {
  node: GraphNode;
  similarity: number;
}

interface NodeDrawerProps {
  node: GraphNode;
  relations: NodeRelation[];
  onClose: () => void;
  onOpenDoc: (id: number) => void;
  onAsk: (nodes: GraphNode[]) => void;
  onSelectNode: (node: GraphNode) => void;
  onVectorized: (node: GraphNode) => void;
}

/**
 * 节点抽屉：文档元信息 + 关联 Top3 + 三个动作（打开 / 提问 / 向量化）。
 * 灰点（未向量化）没有关联，只给"向量化"入口。
 */
const NodeDrawer: React.FC<NodeDrawerProps> = ({
  node,
  relations,
  onClose,
  onOpenDoc,
  onAsk,
  onSelectNode,
  onVectorized,
}) => {
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [vectorizing, setVectorizing] = useState(false);

  useEffect(() => {
    setSummary('');
    if (!node.vectorized) return;
    let cancelled = false;
    setLoading(true);
    getDoc(node.id)
      .then((detail) => {
        if (!cancelled) setSummary(detail.summary ?? '');
      })
      .catch(() => {
        if (!cancelled) setSummary('');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [node.id, node.vectorized]);

  const handleVectorize = async () => {
    setVectorizing(true);
    try {
      await vectorize(node.id);
      message.success('已提交向量化，完成后重新加载地图即可成图');
      onVectorized(node);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '向量化失败');
    } finally {
      setVectorizing(false);
    }
  };

  const askTargets = node.vectorized ? [node, ...relations.slice(0, 2).map((r) => r.node)] : [node];

  return (
    <aside className="vc-kmap-drawer" aria-label="节点详情">
      <header className="vc-kmap-drawer__head">
        <span className="vc-eyebrow">{node.vectorized ? 'Node' : 'Unvectorized'}</span>
        <button type="button" className="vc-kmap-drawer__close" onClick={onClose} aria-label="关闭">
          <Icon icon={xIcon} width={16} />
        </button>
      </header>

      {/* 滚动区：标题 / 元信息 / 摘要 / 关联，内容再长也不影响底部操作区 */}
      <div className="vc-kmap-drawer__scroll">
        <button type="button" className="vc-kmap-drawer__title" onClick={() => onOpenDoc(node.id)}>
          {node.title || '未命名文档'}
        </button>

        <div className="vc-kmap-drawer__meta">
          <Tag className="vc-kmap-drawer__path">{node.folderPath || '/'}</Tag>
          <span>{node.charCount} 字</span>
          {node.vectorized ? <span>{node.chunkCount} 个分片</span> : <Tag color="warning">未向量化</Tag>}
        </div>

        {node.vectorized && (
          <div className="vc-kmap-drawer__summary">
            {loading ? (
              <div className="vc-kmap-drawer__loading">
                <Spin size="small" />
              </div>
            ) : (
              summary || <span className="vc-kmap-drawer__muted">这篇文档还没有摘要。</span>
            )}
          </div>
        )}

        {node.vectorized && (
          <section className="vc-kmap-drawer__section">
            <h3>关联文档</h3>
            {relations.length === 0 ? (
              <p className="vc-kmap-drawer__muted">暂时没有足够相似的文档，它现在是孤岛。</p>
            ) : (
              <ul className="vc-kmap-drawer__relations">
                {relations.slice(0, 3).map((relation) => (
                  <li key={relation.node.id}>
                    <button type="button" onClick={() => onSelectNode(relation.node)}>
                      <span className="vc-kmap-drawer__relation-title">{relation.node.title}</span>
                      <span className="vc-kmap-drawer__relation-sim">
                        {(relation.similarity * 100).toFixed(0)}%
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>

      <footer className="vc-kmap-drawer__actions" onPointerDownCapture={(e) => e.stopPropagation()}>
        <Button
          icon={<Icon icon={externalLinkIcon} width={14} />}
          onClick={(e) => {
            e.stopPropagation();
            onOpenDoc(node.id);
          }}
          block
        >
          打开文档
        </Button>
        {node.vectorized ? (
          <Button
            type="primary"
            icon={<Icon icon={messageSquareIcon} width={14} />}
            onClick={() => onAsk(askTargets)}
            block
          >
            就它提问
          </Button>
        ) : (
          <Button
            type="primary"
            icon={<Icon icon={zapIcon} width={14} />}
            loading={vectorizing}
            onClick={() => void handleVectorize()}
            block
          >
            向量化
          </Button>
        )}
      </footer>
    </aside>
  );
};

export default NodeDrawer;
