/**
 * 知识地图 API（GET /knowledge/graph）。
 *
 * 后端只返回结构（节点 / 边 / 簇 / 孤岛），坐标由前端力导向布局计算。
 */
import { http } from '@/api/client';

export interface GraphNode {
  id: number;
  title: string;
  folderId: number | null;
  folderPath: string;
  chunkCount: number;
  charCount: number;
  vectorized: boolean;
  degree: number;
  clusterId: number;
  colorKey: number;
}

export interface GraphEdge {
  source: number;
  target: number;
  similarity: number;
  sharedTags: string[];
}

export interface GraphCluster {
  id: number;
  label: string;
  size: number;
  folderId: number | null;
  colorKey: number;
}

export interface GraphIslands {
  isolated: number[];
  unvectorized: GraphNode[];
}

export interface GraphMeta {
  model: string | null;
  docCount: number;
  nodeCount: number;
  edgeCount: number;
  degraded: boolean;
  maxNodes: number;
  computedAt: number;
  elapsedMs: number;
}

export interface GraphResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
  clusters: GraphCluster[];
  islands: GraphIslands;
  meta: GraphMeta;
}

export interface GraphQuery {
  folderId?: number | null;
  maxNodes?: number;
  includeUnvectorized?: boolean;
}

export async function getKnowledgeGraph(query: GraphQuery = {}): Promise<GraphResponse> {
  return http.get<GraphResponse>('/knowledge/graph', {
    folderId: query.folderId ?? undefined,
    maxNodes: query.maxNodes ?? undefined,
    includeUnvectorized: query.includeUnvectorized === false ? 'false' : 'true',
  });
}
