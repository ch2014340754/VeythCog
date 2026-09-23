import type { KnowledgeBase, KnowledgeDocument } from '../types';

const now = Date.now();
const DAY = 86_400_000;

function doc(
  id: string,
  name: string,
  type: 'pdf' | 'docx' | 'md' | 'txt' | 'csv',
  size: string,
  status: 'completed' | 'processing' | 'failed',
  segmentCount: number,
  offsetDays: number,
): KnowledgeDocument {
  return { id, name, type, size, status, segmentCount, createdAt: now - offsetDays * DAY };
}

const kb1Documents: KnowledgeDocument[] = [
  doc('doc-1', '系统架构设计.pdf', 'pdf', '2.4 MB', 'completed', 48, 30),
  doc('doc-2', '接口规范v3.docx', 'docx', '1.8 MB', 'completed', 32, 25),
  doc('doc-3', '部署手册.md', 'md', '0.5 MB', 'completed', 12, 20),
  doc('doc-4', '性能测试报告.pdf', 'pdf', '3.2 MB', 'completed', 64, 15),
];

const kb2Documents: KnowledgeDocument[] = [
  doc('doc-5', 'DDD建模指南.pdf', 'pdf', '1.6 MB', 'completed', 28, 28),
  doc('doc-6', '微服务拆分规范.docx', 'docx', '2.1 MB', 'completed', 35, 22),
  doc('doc-7', '事件风暴记录.md', 'md', '0.3 MB', 'completed', 8, 18),
];

const kb3Documents: KnowledgeDocument[] = [
  doc('doc-8', 'RESTful接口设计.pdf', 'pdf', '4.5 MB', 'completed', 72, 35),
  doc('doc-9', 'GraphQL最佳实践.docx', 'docx', '1.2 MB', 'completed', 24, 30),
  doc('doc-10', '认证授权方案.pdf', 'pdf', '2.8 MB', 'completed', 45, 26),
  doc('doc-11', '错误码定义.csv', 'csv', '0.4 MB', 'completed', 62, 20),
];

const kb4Documents: KnowledgeDocument[] = [
  doc('doc-12', 'K8s运维手册.pdf', 'pdf', '5.1 MB', 'completed', 38, 40),
  doc('doc-13', '监控告警配置.md', 'md', '0.6 MB', 'completed', 15, 32),
  doc('doc-14', '故障复盘记录.docx', 'docx', '1.4 MB', 'processing', 0, 5),
  doc('doc-15', '容量规划数据.csv', 'csv', '0.8 MB', 'failed', 0, 3),
];

const mockKnowledgeBases: KnowledgeBase[] = [
  {
    id: 'kb-1',
    name: '产品技术文档',
    description: '包含产品架构设计、接口规范、部署运维等核心技术文档，为研发团队提供统一的技术参考',
    documentCount: 12,
    segmentCount: 156,
    totalSize: '24.5 MB',
    coverColor: '#7C3AED',
    documents: kb1Documents,
    createdAt: now - 30 * DAY,
    updatedAt: now - 2 * DAY,
  },
  {
    id: 'kb-2',
    name: '架构设计规范',
    description: '系统架构设计方法论和最佳实践，涵盖DDD、微服务、事件驱动等架构模式',
    documentCount: 8,
    segmentCount: 89,
    totalSize: '18.2 MB',
    coverColor: '#06B6D4',
    documents: kb2Documents,
    createdAt: now - 28 * DAY,
    updatedAt: now - 5 * DAY,
  },
  {
    id: 'kb-3',
    name: 'API参考手册',
    description: '完整的外部与内部API接口文档，包括RESTful和GraphQL接口定义、认证方案和错误码规范',
    documentCount: 15,
    segmentCount: 203,
    totalSize: '32.1 MB',
    coverColor: '#F59E0B',
    documents: kb3Documents,
    createdAt: now - 35 * DAY,
    updatedAt: now - 1 * DAY,
  },
  {
    id: 'kb-4',
    name: '运维知识库',
    description: '基础设施运维知识积累，包含K8s运维、监控告警、故障复盘和容量规划相关文档',
    documentCount: 6,
    segmentCount: 67,
    totalSize: '12.8 MB',
    coverColor: '#10B981',
    documents: kb4Documents,
    createdAt: now - 40 * DAY,
    updatedAt: now - 3 * DAY,
  },
];

export { mockKnowledgeBases };