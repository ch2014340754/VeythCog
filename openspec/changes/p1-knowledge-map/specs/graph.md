# Spec · 知识地图（graph）

> 变更：`p1-knowledge-map` / 2026-11-19
> 说明：行为与验收；实现细节见 `../design.md`。

## 能力范围

`/knowledge?view=map` 提供只读知识地图：结构指标、语义星图、孤岛清单、节点抽屉；返回结构由 `GET /knowledge/graph` 提供。

## 行为契约

### G1 接口

- `GET /knowledge/graph?folderId=&maxNodes=&includeUnvectorized=true`。
- 只使用**单一** `embedding_model`（配置指定优先，否则取库内出现最多的）；响应 `meta.model` 如实返回。
- 节点仅含 `deleted=false && is_vectorized=true` 的文档；未向量化文档只出现在 `islands.unvectorized`。
- 空库：`nodes=[]`、`edges=[]`、`meta.docCount=0`，不是错误。
- 计算失败/超时：返回可用降级结果（簇级或空图）+ `meta.degraded=true`，HTTP 200。

### G2 相似度与建边

- 文档质心 = 分片向量均值，归一化后按 L2 距离计算；`sim = 1 - d/2`。
- 每条边满足：`sim >= minSimilarity`（配置，默认 0.55）且互为 top-k（默认 5）候选。
- 边必须去重，`E <= N*K`。
- 与检索口径一致：不得使用 cosine 或其它距离。

### G3 聚类与孤岛

- 连通分量聚类；`cluster.label` 取分量内 degree 最高文档标题（≤12 字）。
- `degree==0` 的已向量化节点进入 `islands.isolated`。
- `islands.unvectorized` 包含全部未向量化文档（含 `folderPath`/`charCount`）。

### G4 规模保护

- `maxNodes` 默认 300、硬上限 500。
- 超过时按「一级目录」聚合为簇节点（`id = -folderId`），返回 `meta.degraded=true`。
- 前端点击簇节点 → 带 `folderId` 重新请求，逐层下钻。

### G5 缓存

- 10 分钟内存缓存，key 含 `model / maxUpdatedAt / docCount / maxNodes / folderId`。
- 并发请求单飞：同一 key 同时只计算一次；计算失败不写缓存。

### G6 前端

- 仅在 `view=map` 时加载力导向库（`view=doc` 不得加载对应 chunk）。
- 切换视图不卸载文档树，返回后保持滚动与展开态。
- hover 高亮邻居并 dim 其余；点击节点打开抽屉。
- 窄屏（<900px）或 `pointer: coarse`：退化为列表式关联视图，不渲染 canvas。
- 抽屉「就它提问」→ `/chat?docs=<id>,<关联 ids>`，Chat 解析后绑定 `knowledgeDocIds`。

## 验收标准

1. 四指标与 SQL 复核一致（文档数/节点数/边数/孤岛数）。
2. 节点数 ≤300 时与已向量化文档数相等；>300 时出现簇节点且可下钻。
3. 任取一条边，两文档 `sim >= 0.55`，且属于彼此 top-5。
4. 点击节点抽屉数据正确；「打开文档」能进入编辑器且正文完整。
5. 「就它提问」跳转后会话 `knowledgeDocIds` 含该文档。
6. 连续两次请求第二次 < 20ms（缓存命中）；10 并发只计算一次。
7. `view=doc` 的 Network 中无 force-graph chunk。
8. 800px 宽窗口下显示列表式关联视图，功能完整。

## 测试场景

| 场景 | 期望 |
|---|---|
| 1 篇向量化 + 1 篇未向量化 | 1 个孤岛节点 + 1 个灰点，0 条边 |
| 全部互不相似 | 全孤岛，无异常边 |
| 两个模型混存 | 只画主导模型，另一个模型的文档提示需重向量化 |
| 维度不符（改 768） | 20000 + 明确文案，不静默截断 |
| 快速切目录 | 防抖 + 丢弃过期响应，无重复计算 |
