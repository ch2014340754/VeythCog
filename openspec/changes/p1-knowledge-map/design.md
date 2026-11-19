# Design · P1 知识地图（结构总览 + 语义星图 + 孤岛）

> 版本：v1.0（2026-11-19）
> 前置 review：本文件与 `proposal.md` 同时评审，通过后才写 `specs/` 与 `tasks.md`

## 0. 现状与硬约束（读代码得出）

| 事实 | 出处 | 对设计的影响 |
|---|---|---|
| 向量存 `knowledge_embedding`，`vector(1024)`，`embedding_model` 隔离，禁止混查 | `009_knowledge.sql` 建表段、`010_knowledge_v0.3_migration.sql` | 图只取**单一模型**的向量；返回 `meta.model` 让前端可见 |
| 索引为 `ivfflat (embedding vector_l2_ops)`，检索用 `<->`（L2） | `010_knowledge_v0.3_migration.sql` 末尾建索引段、`KnowledgeEmbeddingMapper.xml` L10/L21 | 图的相似度口径必须与检索一致，用 L2，不用 cosine |
| `VectorTypeHandler` 已能把 pgvector 读成 `float[]` | `handler/VectorTypeHandler.java` | 图谱计算直接在 Java 侧做，**不需要新 handler** |
| `KnowledgeEmbedding` 实体已带 `float[] embedding`（标注了 typeHandler） | `entity/KnowledgeEmbedding.java` | 可直接复用实体查询，无需新建 VO |
| `is_vectorized` 默认 `false`，由用户手动触发 | `009_knowledge.sql` 字段注释 | 未向量化文档单独成"灰点"清单，不参与建边 |
| 文档有 `tags TEXT[]` | `009_knowledge.sql` 的 `knowledge_doc` 建表段 | 边 hover 的"共同 tag"零成本可算 |
| 目录树 `knowledge_folder` 自引用，`tree()` 一次返回全量 | `021`、`KnowledgeFolderService` | 簇聚合与 `folderPath` 都能在内存里算，不写递归 SQL |
| 前端无图可视化依赖 | `package.json`（当前 22 个依赖，无 d3/G6） | 需新增一个库，且必须懒加载 |
| Knowledge 页已有 BlockNote 编辑器与树，单文件较大 | `pages/Knowledge/*` | 地图必须独立组件，不能塞进 `index.tsx` |

## 1. 计算模型（数学定义，实现按此为准）

### 1.1 文档质心

对文档 i 的 n 个分片向量 `v_0 … v_{n-1}`（均为 1024 维）：

```
c_i  = (Σ v_k) / n
ĉ_i  = c_i / ‖c_i‖₂        // 单位化；‖c_i‖₂ == 0 时该文档跳过（记入 degraded）
```

**为什么用平均**：文档是多段内容，均值近似"主题中心"，对不同长度文档相对稳定。
**已知缺点**：长文档分片多、主题杂，均值会被稀释成"四不像"，可能对谁都不近。
**可切换实现**：配置 `knowledge.graph.centroid-mode = mean | medoid`。`medoid` 取离均值最近的真实分片向量（计算量 +O(n·D)，可接受）。v1 默认 `mean`，apply 时若实测长文档全成孤岛，切 `medoid`（只改一行选路逻辑）。

### 1.2 相似度

```
d(i,j) = ‖ĉ_i − ĉ_j‖₂  ∈ [0, 2]
sim(i,j) = 1 − d(i,j) / 2  ∈ [0, 1]
```

- 单位向量下 `d² = 2 − 2cosθ`，`sim` 与 cos 单调同序，**只是把 L2 距离线性映射到 [0,1] 便于建阈值**，不宣称等于余弦相似度。
- 与检索口径一致：检索按 `d` 升序取召回，图按同一 `d` 取近邻，**保证"图上连着的 = RAG 会一起召回的那批"**。

### 1.3 建边

```
for i in docs:
    topk_i = 距离最小且 sim ≥ minSim 的前 K 个 j (j ≠ i)
    对 (i,j) 建无向边，去重保留 min(i,j) 字典序
edge.similarity = sim(i,j)
edge.sharedTags = intersect(tags_i, tags_j)   // 可能为空
```

- 默认 `K=5`、`minSim=0.55`，来自配置；两个参数**必须可在不改代码的情况下调**（阈值需真实数据校准）。
- 边数上限 `E ≤ N*K`（默认 1500），防止稠密化。

### 1.4 聚类与孤岛

- **聚类**：邻接表 BFS 求连通分量，`O(N+E)`。每个分量一个 `GraphCluster`，`label` = 分量内 `degree` 最高的文档标题（截断 12 字），`size` = 节点数。
- **孤岛**：`degree == 0` 的已向量化节点。
- **未向量化**：单独 SQL 查，不进向量计算，输出到 `islands.unvectorized`。

### 1.5 规模保护（N > maxNodes，默认 300）

```
按「一级目录」聚合（folderId 为 null 的归 root 簇）：
  簇节点 size = 组内文档数
  簇边     = 组间文档对的最大 sim（≥ minSim 才建）
支持 folderId 参数下钻：只取该子树文档重新计算（子树 ≤ maxNodes 时正常出图）
```

- 返回 `meta.degraded=true`，前端工具栏显示"已按目录折叠，点击簇展开"。
- 前端点簇节点 → 携带 `folderId` 重新请求（若仍超限，继续下一层目录）。

## 2. API 契约（context-path `/api`）

### 2.1 `GET /knowledge/graph`

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `folderId` | long | 否 | 下钻只看某目录子树（null/省略 = 全库） |
| `maxNodes` | int | 否 | 覆盖配置，硬上限 500 |
| `includeUnvectorized` | bool | 否 | 默认 true；false 时不下发灰点清单 |

响应 `GraphResponse`：

```java
@Data
public class GraphResponse {
    private List<GraphNode> nodes;        // 已向量化节点（或簇节点）
    private List<GraphEdge> edges;
    private List<GraphCluster> clusters;
    private Islands islands;
    private GraphMeta meta;
}

@Data
public class GraphNode {
    private Long id;            // docId；簇节点为 -folderId（负数，前端据此区分）
    private String title;
    private Long folderId;
    private String folderPath;  // "技术/中间件"，根级 "/"
    private int chunkCount;     // 节点大小依据
    private int charCount;      // markdown_text 长度
    private boolean vectorized; // 恒 true（灰点在 islands）
    private int degree;         // 用于视觉与排序
    private int clusterId;
    private int colorKey;       // 0-7，前端调色板索引；由 folderId 稳定哈希得出
}

@Data
public class GraphEdge {
    private Long source;
    private Long target;
    private double similarity;  // 0-1，保留 3 位
    private List<String> sharedTags; // 可为空数组
}

@Data
public class GraphCluster {
    private int id;
    private String label;
    private int size;
    private Long folderId;
    private int colorKey;
}

@Data
public class Islands {
    private List<Long> isolated;      // degree=0 的已向量化 docId
    private List<GraphNode> unvectorized; // vectorized=false 的节点（含 folderPath/charCount）
}

@Data
public class GraphMeta {
    private String model;        // 本次计算使用的 embedding 模型
    private int docCount;        // 库内未删除文档总数
    private int nodeCount;
    private int edgeCount;
    private boolean degraded;     // 是否发生目录簇聚合
    private int maxNodes;
    private long computedAt;      // ms（缓存命中时返回上次计算时间）
    private long elapsedMs;       // 本次计算耗时，便于前端展示与排查
}
```

**契约要点**

- `nodes` 只含可建图节点；`islands.unvectorized` 是"灰点"，前端合并渲染但样式区分，**不参与边**。
- 空库：`nodes=[]`、`edges=[]`、`meta.docCount=0`，不是错误。
- 有文档但全未向量化：`nodes=[]`、`islands.unvectorized` 全量、`meta.model=null`，前端展示引导"先向量化才能生成星图"。
- 坐标（x/y）**不下发**：布局完全由前端负责，后端只管结构。

### 2.2 错误码

| 场景 | bizCode | 说明 |
|---|---|---|
| 未登录 | 40100 | 前端已拦截 |
| 计算超时（>3s） | 20000 + `degraded=true` + 返回簇级图或空图 | 不让前端等到 30s |
| 向量维度与配置不符 | 20000 + 提示"向量模型变更，需重新向量化" | 维度硬校验，禁止静默出错 |

## 3. 后端设计

### 3.1 类清单

| 文件 | 说明 |
|---|---|
| `vc-knowledge/service/KnowledgeGraphService.java` + `impl/KnowledgeGraphServiceImpl.java` | 主算法：质心 → 距离 → top-k → 聚类 → 孤岛 → 缓存 |
| `vc-knowledge/mapper/KnowledgeEmbeddingMapper.java` + XML | `selectVectorsByModel`、`selectDominantModel` |
| `vc-knowledge/dto/graph/*.java` | 上述 6 个 DTO |
| `vc-knowledge/config/KnowledgeProperties` | 加 `graph.*` 配置（k、阈值、maxNodes、TTL、centroid-mode） |
| `vc-app/web/KnowledgeController.java` | `GET /knowledge/graph`（薄控制器，只做参数校验与 DTO 透传） |

### 3.2 SQL

```xml
<resultMap id="DocChunkVectorMap" type="com.vc.knowledge.dto.graph.DocChunkVector">
    <result column="doc_id"    property="docId"/>
    <result column="embedding" property="embedding"
            typeHandler="com.vc.knowledge.handler.VectorTypeHandler"/>
</resultMap>

<select id="selectVectorsByModel" resultMap="DocChunkVectorMap">
    SELECT e.doc_id, e.embedding
      FROM knowledge_embedding e
      JOIN knowledge_doc d ON d.id = e.doc_id
     WHERE d.deleted = false
       AND d.is_vectorized = true
       AND e.embedding_model = #{model}
       <if test="folderIds != null">
         AND d.folder_id IN <foreach collection="folderIds" item="f" open="(" separator="," close=")">#{f}</foreach>
       </if>
</select>

<select id="selectDominantModel" resultType="java.lang.String">
    SELECT e.embedding_model
      FROM knowledge_embedding e
      JOIN knowledge_doc d ON d.id = e.doc_id
     WHERE d.deleted = false AND d.is_vectorized = true
     GROUP BY e.embedding_model
     ORDER BY count(*) DESC
     LIMIT 1
</select>
```

- **必须用 `resultMap` + typeHandler**：`resultType=DocChunkVector` 时 MyBatis 不会自动套 `VectorTypeHandler`，`float[]` 字段会拿到 `String` 导致 `ClassCastException`（己方踩坑点，写进 tasks 校验项）。
- 模型选择顺序：配置指定 `graph.model` → 否则 `selectDominantModel` → 都没有则返回空图。

### 3.3 算法实现要点

```java
// 1) 聚合质心：Map<docId, float[D] sum + count>
float[] c = sums[i] / cnt[i]; normalize(c);
// 2) 逐行 top-k（不存 N×N 矩阵，内存 O(N·K)）
for i in 0..N-1:
    PriorityQueue<Neighbor> heap (最大堆, size=K)
    for j in i+1..N-1:
        d = l2(unit[i], unit[j]);
        sim = 1 - d / 2;
        if (sim >= minSim) heap.offer(new Neighbor(j, sim));
    ... 双向合并去重
// 3) 连通分量 BFS；4) degree==0 归孤岛
```

- 距离计算用 `float` 累加、`double` 开方，避免 1024 维 float 累加误差累积。
- 复杂度：N=300、D=1024 → 约 4600 万次乘加，JIT 预热后实测预期 30-80ms；N=500 约 2.5 倍。**不用并行流**（线程池已被 workbench 占用，且 100ms 内不值得）。

### 3.4 缓存与单飞

- Key：`model|maxUpdatedAt|docCount|maxNodes|folderId|centroidMode`。
- 容器：`LinkedHashMap`（accessOrder=true）容量 8，`synchronized` 包装；TTL 由 `computedAt` 判断（10 分钟）。
- 单飞：查缓存 → 未命中 → `ReentrantLock per key`（`ConcurrentHashMap<String, Lock>`）→ 锁内二次检查缓存 → 计算 → 写缓存。并发 10 次只算 1 次。
- 计算失败不写缓存（避免把空图钉死 10 分钟）。

### 3.5 超时与降级

- `CompletableFuture.supplyAsync(compute, graphExecutor).orTimeout(3s)`；超时返回簇级聚合图（一次聚合计算量降一个数量级），再超时返回空图 + `degraded=true`。
- 独立线程池 `graphExecutor`（core=1，max=1，queue=8，CallerRunsPolicy），避免与请求线程池互抢；同一时刻只算一张图。

## 4. 前端设计

### 4.1 依赖选型

| 方案 | 体积 | 交互 | 可控性 | 结论 |
|---|---|---|---|---|
| `react-force-graph-2d` | ~50KB gzip（d3-force 系） | 缩放/拖拽/hover/click 开箱 | 中（canvas 回调可完全接管绘制） | **采用** |
| `d3-force` 自绘 | ~35KB | 全部手写（300+ 行） | 最高 | 备选（若 force-graph 与玻璃主题冲突严重） |
| `@antv/g6` | ~500KB+ | 强 | 中（主题改造工作量大） | 不采用 |

安装：`npm i react-force-graph-2d`（自带 d.ts，无需额外 @types）。**只在 `KnowledgeMap.tsx` 内 `await import('react-force-graph-2d')`**，禁止在 `index.tsx` 顶层 import，否则文档树视图也会拉这个包。

### 4.2 组件与数据流

```
Knowledge/index.tsx
 ├─ view = searchParams.get('view') === 'map' ? 'map' : 'doc'
 ├─ pill「文档 / 地图」→ 改 query（replace，不新增历史）
 ├─ view==='doc'  → 现有 DocTree + DocEditor
 └─ view==='map'  → <KnowledgeMap/>
        ├─ useGraphData(folderId)   // 请求 + 缓存 + 失败保留旧图
        ├─ <MapHeader/>             // 4 个数字 + 模型名 + 目录筛选 + 仅看孤岛
        ├─ <MapCanvas nodes edges/> // 动态 import 的 force graph
        └─ <NodeDrawer node/>       // 右侧 360px 抽屉
```

- 切到 map 时，**文档树不卸载**（保留在下方 `visibility:hidden`），避免切回时重建树与编辑器。
- 数据到达前显示"正在计算知识地图…"骨架（三条占位线 + 细进度条），不等 30s。

### 4.3 画布绘制（`MapCanvas.tsx`）

| 元素 | 规则 |
|---|---|
| 节点半径 | `r = 4 + 6 * sqrt(chunkCount / maxChunk)`，上限 14；孤岛节点 4 |
| 节点颜色 | 8 色调色板（低饱和，暗色模式自动降明度），索引 = `node.colorKey` |
| 光晕 | `ctx.shadowBlur = 12`、`shadowColor = 节点色 @ 0.35`；**只在 degree>0 时画**，孤岛不发光（视觉上就"暗"） |
| 标签 | `zoom > 0.9 && nodeCount <= 200` 时绘制标题（12px，`--text-secondary`），否则不画 |
| 边 | `rgba(accent, 0.10 + 0.30 * sim)`，线宽 1；hover 中的边提到 0.55 |
| hover | 预计算 `adjacency: Map<id, Set<id>>`；非邻居 `globalAlpha=0.18`，邻居保持 1 |
| 点击 | 打开 `NodeDrawer`；簇节点（id<0）→ 带 `folderId` 重新请求 |
| 停止 | `cooldownTicks(90)`；`onEngineStop` 后不再重绘（除非 hover/resize） |

性能参数：`d3AlphaDecay(0.05)`、`d3VelocityDecay(0.35)`；节点 >200 关闭 `linkDirectionalParticles`（本就不启用）。

### 4.4 抽屉（`NodeDrawer.tsx`）

内容顺序：标题（可点进文档）→ 目录路径 chip + 字数 + chunk 数 → 摘要（300 字滚动）→ 关联 Top3（标题 + 相似度百分比，点击切换节点）→ 操作行：

- **打开文档**：`navigate('/knowledge?doc=<id>')`（复用工作台的 query 约定）
- **就它提问**：`navigate('/chat?docs=<id>,<关联1>,<关联2>&prefill=<标题 要点>`（见 §5）
- **向量化**（仅灰点）：调用 `vectorize(id)`，成功后本地把该节点移入 `nodes`（deg=0、`colorKey` 同目录），并提示"重新计算后生效"

抽屉过渡：`translateX` + `opacity`，`--motion-duration-slow`；禁止 `transition: all`。

### 4.5 工具栏与指标

- 四个数字：文档数、节点数、边数、孤立数（`tabular-nums`）；右侧小字 `模型: xxx · 计算于 x 分钟前`。
- 目录筛选：下拉复用现有树数据（`getTree()` 一次），选中后按 `folderId` 请求。
- 「仅看孤岛」：前端过滤 `degree==0` + `islands.unvectorized`，不重新请求。
- 「重新布局」：清缓存（前端）+ `?force=true`（后端跳过缓存，可选）。

### 4.6 降级

| 条件 | 行为 |
|---|---|
| `pointer: coarse` 或容器宽 <900px | 不渲染 canvas，改列表式：孤岛分组 + 每个文档 Top3 关联行（纯 DOM，可滚动） |
| `prefers-reduced-motion: reduce` | 允许力导向布局，但 `cooldownTicks=0` 一次性静态布局，不播动画 |
| 后端返回空图 | 空态："还没有可建图的文档 → 去向量化" 按钮 |
| 请求失败 | 保留上次图（localStorage 只存 nodes/edges 摘要 20KB 上限），顶部提示 |

## 5. 闭环衔接（`?docs=` 传参）

`Chat/index.tsx` 现状：只读 `prefill`（L67）。改动：

```ts
const docsParam = new URLSearchParams(window.location.search).get('docs');
// 新建会话时：createConversation(title, model, docsIds)  —— api 已支持 docIds 参数
// 已有活跃会话时：updateConversation(activeConvId, { docIds })
// prefill 仍走现有逻辑；docs 解析失败（非数字）直接忽略
```

- 只做一次，随后清掉 URL 参数，避免刷新重复设置。
- 与 `p1-unified-workbench` 的 `?c=`、`?doc=` 同一处代码改，两个 change 合并时按"参数解析工具函数"抽公共（`utils/queryIntent.ts`）。

## 6. 边界与异常

| 场景 | 处理 |
|---|---|
| 全库只有 1 篇文档 | 1 个节点 0 条边，孤岛面板列出它；文案"再写一篇就能看到关联" |
| 所有文档互不相似 | 全孤岛，星图只有散点；面板提示"内容还比较分散，可考虑建目录归类" |
| 两篇内容几乎相同（复制文档） | 边 similarity≈1，正常展示；不做去重建议 |
| 不同 embedding 模型混存 | 只取主导模型；`meta.model` 标明；灰点里的其他模型文档提示"需重新向量化" |
| 向量维度被改（1024→768） | 维度校验失败 → 20000 + 明确文案，禁止静默截断 |
| 请求并发（切目录狂点） | 前端 300ms 防抖 + 丢弃过期响应（AbortController）；后端单飞兜底 |
| 缓存与真实数据不一致（文档刚改） | `maxUpdatedAt` 变化 → key 变化，自动失效 |

## 7. 风险与验证点（apply 必须逐条过）

1. **embedding 同质化**：同类文本距离普遍很近，星图容易连成"球"。验证：用真实库跑一遍，统计边数 / (N·K) 比例；若 >0.8 说明阈值过低，用真实数据把 `minSim` 调到 0.55-0.7 之间再定值（**不拍脑袋**）。
2. **长文质心稀释**：抽查 3 篇长文的 `degree`，若全为 0 而内容明显相关，切 `centroid-mode=medoid` 复测。
3. **SQL 类型映射**：`selectVectorsByModel` 必须走 `resultMap`，单测断言 `embedding.length == 1024`（踩坑点）。
4. **性能**：300 节点后端 <200ms（含 DB 读取）；第二次请求（缓存命中）<20ms；前端首帧 <1.5s、交互 ≥30fps。
5. **并发单飞**：10 个并发请求，日志中 `compute` 只出现 1 次。
6. **懒加载**：`view=doc` 时 Network 面板不得出现 force-graph 相关 chunk。
7. **降级等价**：窄屏列表式视图功能完整（能打开文档、能看 Top3），不是"残缺版"。
8. **回滚**：删 `KnowledgeMap/MapCanvas/NodeDrawer/map.css` + `knowledge/index.tsx` 还原 pill + 卸载依赖即可；后端删 `graph` 包与一个接口，无 DDL 回滚成本。

## 8. 工作量估算

| 项 | 人日 |
|---|---|
| 后端：mapper/DTO/算法/缓存/单飞/接口 | 2.5 |
| 前端：地图组件 + force 绘制 + 抽屉 + 工具栏 | 3.0 |
| Chat `?docs=` 传参（与 workbench 共用） | 0.5 |
| 真实数据校准阈值 + 性能验证 + 降级验证 | 1.0 |
| 联调 + 质量门 + 文档同步 | 1.0 |
| **合计** | **8.0** |

> 依赖关系：`p1-knowledge-map` 与 `p1-unified-workbench` 都会改 `Knowledge/index.tsx`（前者加 pill，后者加 `?doc=` 打开）与 `Chat/index.tsx`（前者加 `docs`，后者加 `c`）。**建议同批 apply**，先合 `p1-unified-workbench` 的 query 参数工具，再做地图，可省 0.5 人日重复劳动。
