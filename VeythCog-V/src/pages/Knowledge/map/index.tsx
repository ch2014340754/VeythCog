import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, message, Select, Skeleton, Switch } from 'antd';
import { Icon } from '@iconify/react';
import refreshIcon from '@iconify-icons/lucide/refresh-cw';
import sparklesIcon from '@iconify-icons/lucide/sparkles';
import { useNavigate } from 'react-router-dom';
import { getKnowledgeGraph, type GraphNode, type GraphResponse } from '@/api/graph';
import { getTree } from '@/api/knowledge';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { formatRelativeTime } from '@/utils/formatTime';
import MapCanvas from './MapCanvas';
import NodeDrawer, { type NodeRelation } from './NodeDrawer';
import './map.css';

interface KnowledgeMapProps {
  /** 打开文档：由 Knowledge 页切回文档视图并选中 */
  onOpenDoc: (id: number) => void;
}

interface FolderOption {
  value: number;
  label: string;
}

/**
 * 知识地图：结构总览 + 语义星图 + 孤岛。
 * 后端只给结构，布局在前端力导向；窄屏/不支持 canvas 时降级为列表视图（功能等价）。
 */
const KnowledgeMap: React.FC<KnowledgeMapProps> = ({ onOpenDoc }) => {
  const navigate = useNavigate();
  const narrow = useMediaQuery('(max-width: 900px)');

  const [data, setData] = useState<GraphResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [folderId, setFolderId] = useState<number | null>(null);
  const [onlyIsolated, setOnlyIsolated] = useState(false);
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [folders, setFolders] = useState<FolderOption[]>([]);
  const seqRef = useRef(0);

  const load = useCallback(async (targetFolderId: number | null) => {
    const seq = ++seqRef.current;
    setLoading(true);
    try {
      const response = await getKnowledgeGraph({ folderId: targetFolderId, includeUnvectorized: true });
      if (seq !== seqRef.current) return;
      setData(response);
      setError('');
      setSelected((prev) => (prev && !response.nodes.some((n) => n.id === prev.id) ? null : prev));
    } catch (e) {
      if (seq !== seqRef.current) return;
      // 失败保留旧图，只在顶部提示
      setError(e instanceof Error ? e.message : '知识地图加载失败');
    } finally {
      if (seq === seqRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(folderId);
  }, [folderId, load]);

  useEffect(() => {
    getTree()
      .then((tree) => {
        const byParent = new Map<number | null, typeof tree.folders>();
        for (const folder of tree.folders) {
          const list = byParent.get(folder.parentId) ?? [];
          list.push(folder);
          byParent.set(folder.parentId, list);
        }
        const options: FolderOption[] = [];
        const walk = (parentId: number | null, depth: number) => {
          for (const folder of byParent.get(parentId) ?? []) {
            options.push({ value: folder.id, label: `${'　'.repeat(depth)}${folder.name}` });
            walk(folder.id, depth + 1);
          }
        };
        walk(null, 0);
        setFolders(options);
      })
      .catch(() => setFolders([]));
  }, []);

  const relations = useMemo<NodeRelation[]>(() => {
    if (!data || !selected) return [];
    const byId = new Map(data.nodes.map((node) => [node.id, node]));
    const related: NodeRelation[] = [];
    for (const edge of data.edges) {
      const other =
        edge.source === selected.id ? edge.target : edge.target === selected.id ? edge.source : null;
      if (other == null) continue;
      const node = byId.get(other);
      if (node) related.push({ node, similarity: edge.similarity });
    }
    return related.sort((a, b) => b.similarity - a.similarity);
  }, [data, selected]);

  const isolatedNodes = useMemo(
    () => (data ? data.nodes.filter((node) => node.degree === 0) : []),
    [data]
  );

  const handleSelect = (node: GraphNode) => {
    if (node.id < 0) {
      // 簇节点：按目录下钻；根簇回到全库
      setFolderId(node.folderId ?? null);
      setSelected(null);
      return;
    }
    setSelected(node);
  };

  const handleAsk = (nodes: GraphNode[]) => {
    const ids = nodes.map((node) => node.id).filter((id) => id > 0);
    if (ids.length === 0) {
      message.warning('未向量化的文档不能直接提问，请先向量化');
      return;
    }
    const keyword = nodes[0]?.title ?? '知识地图';
    navigate(`/chat?docs=${ids.join(',')}&prefill=${encodeURIComponent(`关于《${keyword}》，`)}`);
  };

  const handleVectorized = () => {
    setSelected(null);
    void load(folderId);
  };

  const displayNodes = onlyIsolated
    ? [...isolatedNodes, ...(data?.islands.unvectorized ?? [])]
    : [...(data?.nodes ?? []), ...(data?.islands.unvectorized ?? [])];
  const displayEdges = onlyIsolated ? [] : data?.edges ?? [];
  const hasCanvas = typeof window !== 'undefined' && 'requestAnimationFrame' in window;

  return (
    <section className="vc-kmap">
      <header className="vc-kmap__bar">
        <div className="vc-kmap__stats">
          <span>
            <b>{data?.meta.docCount ?? 0}</b> 文档
          </span>
          <span>
            <b>{data?.meta.nodeCount ?? 0}</b> 节点
          </span>
          <span>
            <b>{data?.meta.edgeCount ?? 0}</b> 关联
          </span>
          <span>
            <b>{isolatedNodes.length}</b> 孤岛
          </span>
          {data?.meta.model ? <em className="vc-kmap__stamp">模型 {data.meta.model}</em> : null}
          {data?.meta.computedAt ? (
            <em className="vc-kmap__stamp">计算于 {formatRelativeTime(data.meta.computedAt)}</em>
          ) : null}
        </div>

        <div className="vc-kmap__tools">
          <Select
            size="small"
            className="vc-kmap__folder"
            value={folderId ?? 0}
            onChange={(value) => setFolderId(Number(value) || null)}
            options={[{ value: 0, label: '全库' }, ...folders]}
            popupMatchSelectWidth={false}
            showSearch
            optionFilterProp="label"
          />
          <label className="vc-kmap__switch">
            <Switch size="small" checked={onlyIsolated} onChange={setOnlyIsolated} />
            仅看孤岛
          </label>
          <Button
            size="small"
            icon={<Icon icon={refreshIcon} width={14} />}
            onClick={() => {
              setSelected(null);
              void load(folderId);
            }}
          >
            重新计算
          </Button>
        </div>
      </header>

      {loading && <div className="vc-kmap__progress" aria-hidden />}
      {error && (
        <div className="vc-kmap__error">
          <span>{error}</span>
          <Button size="small" type="link" onClick={() => void load(folderId)}>
            重试
          </Button>
        </div>
      )}
      {data?.meta.degraded && (
        <p className="vc-kmap__notice">文档较多，已按一级目录折叠。点击簇节点可以下钻查看目录内部结构。</p>
      )}

      <div className="vc-kmap__body">
        {loading && !data ? (
          <div className="vc-kmap__skeleton">
            <Skeleton active paragraph={{ rows: 6 }} />
            <span className="vc-kmap__hint">正在计算知识地图…</span>
          </div>
        ) : displayNodes.length === 0 ? (
          <div className="vc-kmap__empty">
            <Icon icon={sparklesIcon} width={30} />
            <h3>还没有可建图的文档</h3>
            <p>
              {data && data.islands.unvectorized.length > 0
                ? `库里有 ${data.islands.unvectorized.length} 篇未向量化文档，先向量化就能看到关联。`
                : '星图来自已向量化文档的语义相似度，先写几篇文档并向量化。'}
            </p>
          </div>
        ) : narrow || !hasCanvas ? (
          <div className="vc-kmap__list">
            {(data?.islands.unvectorized ?? []).length > 0 && (
              <div className="vc-kmap__list-group">
                <h3>未向量化 · {data!.islands.unvectorized.length}</h3>
                <ul>
                  {data!.islands.unvectorized.map((node) => (
                    <li key={node.id}>
                      <button type="button" onClick={() => setSelected(node)}>
                        <span>{node.title}</span>
                        <em>{node.folderPath}</em>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {isolatedNodes.length > 0 && (
              <div className="vc-kmap__list-group">
                <h3>孤岛 · {isolatedNodes.length}</h3>
                <ul>
                  {isolatedNodes.map((node) => (
                    <li key={node.id}>
                      <button type="button" onClick={() => setSelected(node)}>
                        <span>{node.title}</span>
                        <em>{node.folderPath}</em>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="vc-kmap__list-group">
              <h3>已关联 · {displayNodes.filter((node) => node.degree > 0).length}</h3>
              <ul>
                {displayNodes
                  .filter((node) => node.degree > 0)
                  .map((node) => {
                    const related = (data?.edges ?? [])
                      .filter((edge) => edge.source === node.id || edge.target === node.id)
                      .slice(0, 3)
                      .map((edge) => {
                        const otherId = edge.source === node.id ? edge.target : edge.source;
                        const other = data?.nodes.find((n) => n.id === otherId);
                        return other ? `${other.title} ${(edge.similarity * 100).toFixed(0)}%` : '';
                      })
                      .filter(Boolean);
                    return (
                      <li key={node.id}>
                        <button type="button" onClick={() => setSelected(node)}>
                          <span>{node.title}</span>
                          <em>{related.join(' · ') || node.folderPath}</em>
                        </button>
                      </li>
                    );
                  })}
              </ul>
            </div>
          </div>
        ) : (
          <MapCanvas
            nodes={displayNodes}
            edges={displayEdges}
            selectedId={selected?.id ?? null}
            onSelect={handleSelect}
            onBackground={() => setSelected(null)}
          />
        )}

        {selected && (
          <NodeDrawer
            node={selected}
            relations={relations}
            onClose={() => setSelected(null)}
            onOpenDoc={onOpenDoc}
            onAsk={handleAsk}
            onSelectNode={setSelected}
            onVectorized={handleVectorized}
          />
        )}
      </div>
    </section>
  );
};

export default KnowledgeMap;
