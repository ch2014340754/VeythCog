# Proposal · P1 知识地图（结构总览 + 语义星图 + 孤岛）

> 版本：v1.0（2026-11-19）
> 状态：待 review（「待确认」7 条拍板后再 apply）
> 关联：`openspec/knowledge-prd.md`、`openspec/changes/p1-knowledge-folder-tree/design.md`、`PROJECT_MEMORY.md` §4 RAG 现状

## 为什么做（Why）

知识库现在只有两种视图，都是**逐篇**的视角：

- `GET /knowledge/list` 平铺分页 + 关键词搜索；
- 知识树（`knowledge_folder` + `doc_tree`）按目录组织，回答"文档在哪"，不回答"我的知识长什么样"。

三个具体问题：

1. **看不见全局**：文档到 50+ 篇之后，用户无法感知主题分布、哪些主题厚、哪些主题只有一篇；
2. **孤岛无人发现**：写完没入任何上下文、也没被 RAG 召回过一次的文档，永远沉在树底；
3. **RAG 覆盖度不可见**：`is_vectorized=false` 的文档对召回完全不可见，但界面没有任何提示它们占比多少。

而数据其实已经齐了：`knowledge_embedding` 有 `vector(1024)` 分片向量、`embedding_model` 隔离、`knowledge_doc.tags[]`、目录树结构。**不需要 LLM 抽取实体、不需要新表、不需要 Neo4j**，就能画出一张有意义的图。

## 做什么（What）

一句话：**在知识库页新增「地图」视图（`/knowledge?view=map`）：关键指标 + 语义星图 + 孤岛清单，全部只读、复用现有向量；节点点开可看摘要、相关文档，并一键「就它提问」进入对话。**

### 后端

1. `GET /knowledge/graph`（`KnowledgeGraphService` + `KnowledgeEmbeddingMapper` 新查询）：读全部已向量化文档的分片向量 → Java 侧算文档质心 → 归一化 → N×N L2 距离 → top-k 建边 → 连通分量聚类 → 孤岛/未向量化清单。
2. 规模保护：节点数 > `maxNodes`（默认 300）时按目录聚合成"簇节点"，支持 `folderId` 下钻只看某目录子树。
3. 结果内存缓存（fingerprint = embedding 模型 + 文档最大 `updated_at` + 文档数），10 分钟 TTL + 单飞保护，避免并发重复计算。

### 前端

1. `pages/Knowledge/KnowledgeMap.tsx` + `MapCanvas.tsx` + `NodeDrawer.tsx` + `map.css`；页头 pill「文档 / 地图」切换，不新增 rail 入口。
2. 力导向图用 `react-force-graph-2d`，**只在 map 视图动态 import**，不进入文档树视图的首包。
3. 视觉延续黑底玻璃 + 科技蓝：节点按目录着色、外发光 halo，边透明度随相似度，hover 高亮邻居并 dim 其余。
4. 节点抽屉：标题/目录/摘要/字数/chunk 数/关联 Top3/操作（打开文档、就它提问、去向量化）。
5. 孤岛面板：孤立文档 + 未向量化文档两类，支持一键跳转处理。

### 闭环衔接（与「知识闭环」方向对齐）

`NodeDrawer` 的「就它提问」→ `navigate('/chat?docs=<id1>,<id2>')`，Chat 侧解析后把 `knowledgeDocIds` 带入会话上下文——图谱从"展示控件"变成知识闭环的入口。Chat 增加 `docs` 参数属于本 change 的前置小改动（与 `p1-unified-workbench` 的 `?c=` 参数改同一处代码，需协调合并）。

## 范围（Scope）

### In-scope

| 能力 | 说明 |
|---|---|
| 结构总览 | 节点数/边数/孤立数/未向量化数/目录分布条（顶部 4 个数字 + 一条横向占比条） |
| 语义星图 | 文档为节点、相似度为边；节点大小=chunk 数，颜色=目录，hover/点击/缩放/拖拽 |
| 孤岛清单 | `degree=0` 的已向量化文档 + 全部未向量化文档（灰点），可一键打开/处理 |
| 节点抽屉 | 摘要 + 关联 Top3 + 打开文档 / 就它提问 / 向量化 |
| 目录筛选与下钻 | 顶部目录下拉；>300 节点自动按目录折叠成簇，点击簇下钻 |
| 缓存与单飞 | 10 分钟内存缓存；并发请求只算一次 |
| 降级 | 窄屏/触屏设备退化为列表式关联视图；`prefers-reduced-motion` 只做静态布局 |

### Out-of-scope

- ❌ **LLM 实体/关系抽取**（三元组表、实体归一、抽取任务）——本轮明确不做，理由见 proposal 待确认 3；
- ❌ 跨模块图谱（书签、剪藏、对话、音乐纳入同一张图）；
- ❌ 图编辑（手动连线/断边/批注）、图谱版本历史、时序演进动画；
- ❌ 3D 视图、VR/AR；
- ❌ 图算法高级特性（社区检测 Louvain、中心性、最短路径查询）——本轮只用连通分量；
- ❌ 把图谱结果喂回 RAG（如"按图扩展召回"），属于后续独立变更。

## 影响面

### 数据库

- **无新表、无新列、无新索引**。
- 唯一风险：一次读取全部分片向量（`doc_id, embedding`）会走 `idx_knowledge_embedding_doc_model`；N 篇 × 平均 chunk 数 × 1024 float，300 篇约 1-2MB 传输，可接受。若后续文档量 >1000 篇，再讨论"预先落 `doc_centroid` 列"的方案（不在本轮）。

### 后端

| 文件 | 动作 |
|---|---|
| `vc-knowledge/service/KnowledgeGraphService.java` + `impl` | 新增（质心/建边/聚类/孤岛/缓存） |
| `vc-knowledge/mapper/KnowledgeEmbeddingMapper.java` + XML | 新增 `selectVectorsByModel`（按模型分组读分片） |
| `vc-knowledge/dto/graph/{GraphResponse,GraphNode,GraphEdge,GraphCluster,GraphMeta}.java` | 新增 |
| `vc-knowledge/config/KnowledgeProperties` | 加 `graph.max-nodes=300`、`graph.top-k=5`、`graph.min-similarity=0.55`、`graph.cache-ttl=10m`、`graph.model`（可选指定） |
| `vc-app/web/KnowledgeController.java` | 加 `GET /knowledge/graph` |
| `vc-app/web/ChatController` / 前端 Chat 页 | 支持 `docs` 参数（前置小改动，见 §5 闭环衔接） |

### 前端

| 文件 | 动作 |
|---|---|
| `package.json` | 新增 `react-force-graph-2d`（仅 map 视图动态 import） |
| `src/pages/Knowledge/index.tsx` | 加视图 pill 与 `?view=map` 读取；原文档树逻辑不动 |
| `src/pages/Knowledge/KnowledgeMap.tsx` | 新增：取数、聚合指标、工具栏、空态 |
| `src/pages/Knowledge/MapCanvas.tsx` | 新增：force graph 封装（节点绘制、hover、点击、resize） |
| `src/pages/Knowledge/NodeDrawer.tsx` | 新增：节点详情抽屉 |
| `src/pages/Knowledge/map.css` | 新增：星图/抽屉/工具栏样式（只用主题变量） |
| `src/api/knowledge.ts` | 新增 `getGraph(params)` |
| `src/types/index.ts` | 新增 `KnowledgeGraph*` 类型 |

### 文档

- `PROJECT_MEMORY.md` §4（RAG 状态）、§6（接口契约）、`openspec/api-spec.md` 同步；
- `VeythCog-V/docs/frontend-style-guide.md` 增补「图谱节点/边/抽屉」视觉条目。

## 验收总则（每条都可演示）

前置：知识库至少 12 篇已向量化文档（含 1 篇与其余全部不相似、1 篇未向量化）。

1. 进入 `/knowledge`，页头出现「文档 / 地图」pill；切到地图，原树不闪退、滚动位置保留。
2. 顶部四个数字与库内实际一致（用 SQL 复核）：文档数、节点数、边数、孤立数；未向量化数单独标注。
3. 星图节点数 = 已向量化且未删除文档数（≤300 时）；节点大小随 chunk 数递增；颜色按目录分区。
4. 边只出现在相似度 ≥ 阈值且互为 top-k 的文档之间；hover 一条边显示两文档共同 tag（无共同 tag 时不显示解释，但边仍在）。
5. 点击节点 → 右侧抽屉打开，摘要/目录/字数/chunk 数正确；「关联 Top3」列出该文档距离最近的 3 篇（含相似度百分比）。
6. 抽屉「就它提问」→ 跳 `/chat`，输入框预填"帮我梳理《标题》的要点"，且会话已绑定该文档；发送后 RAG 引用卡片来自该文档。
7. 孤岛面板列出孤立文档与未向量化文档；点未向量化项 → 抽屉内出现「立即向量化」，执行后该点从灰变亮、并进入星图（需重算缓存）。
8. 切到「文档」视图，树、拖拽、右键、搜索、编辑器全部与改造前一致。
9. 造 320 篇（或用 mock 放大数据）验证：自动折叠为目录簇，点簇可下钻；页面不卡死（首帧 <1.5s，交互 30fps 以上）。
10. 窗口缩到 800px 或模拟触屏：退化为列表式关联视图（孤岛 + 每篇 Top3），不渲染 canvas。
11. 质量门：后端 `mvn -pl vc-app -am compile` 通过；前端 `npx tsc --noEmit` + `npm run build` 通过；`doc.html` 手测 `/knowledge/graph` 结构与本 design 一致。

## 待确认（review 逐条拍板，括号内为推荐）

1. **入口位置**：`/knowledge` 页内 pill 切换（推荐，地图是知识库的第二种视角，不新增路由）/ 独立 `/knowledge/map` 路由 + rail 新入口（导航项变多）/ 新增顶级「图谱」模块（语义过重）。
2. **相似度口径**：复用检索同款 **L2 距离**（推荐，保证"图上近邻 = RAG 近邻"）/ cosine（数值更直观，但与检索口径分裂）。
3. **建边参数**：`top-k=5`、`min-similarity=0.55` 可配置，**首次 apply 用真实数据校准**（推荐）/ 写死常量（不可调）。
4. **规模保护**：>300 节点按目录折叠成簇（推荐）/ 一次画全量（超过 500 必然卡）/ 直接只画最近 200 篇（会漏掉老文档）。
5. **未向量化文档**：以灰点纳入星图并计入孤岛（推荐，能反向推动补向量化）/ 完全不显示。
6. **可视化库**：`react-force-graph-2d`（推荐，50KB 级、开箱交互）/ `d3-force` 自绘（完全可控但多 300 行代码）/ `@antv/g6`（体积大、主题改造重）。
7. **闭环跳转**：本轮一并做 `?docs=` 传参（推荐，图谱才有"入口"意义）/ 只保留「打开文档」，跳转留到知识闭环专项。
</content>
