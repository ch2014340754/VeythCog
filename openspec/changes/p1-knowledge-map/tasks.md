# Tasks · P1 知识地图（结构总览 + 语义星图 + 孤岛）

> 状态：apply 完成（2026-11-19），真实库接口已验证；阈值待真实数据校准
> 规则：一项完成并验证后再进入下一项（`agent.md` §2.3）

## A. 后端 · 数据与 DTO

- [x] A1 `dto/graph/{GraphResponse,DocMeta,DocChunkVector}.java`（`GraphResponse` 内含 `GraphNode/GraphEdge/GraphCluster/Islands/GraphMeta`）
- [x] A2 `KnowledgeEmbeddingMapper` 加 `selectVectorsByModel(model, folderIds)`、`selectDominantModel()`
- [x] A3 `KnowledgeEmbeddingMapper.xml` 加 `DocChunkVectorMap`（**必须** `resultMap` + `VectorTypeHandler`，`resultType` 会拿到 String 导致 ClassCastException）
- [x] A4 `KnowledgeDocMapper` 加 `selectDocMeta(vectorized, folderIds)`、`countAll()`；XML 加 `DocMetaMap`（tags 用 `StringArrayTypeHandler`）
- [x] A5 `KnowledgeProperties` 加 `graph.*`：`k=5` / `minSimilarity=0.55` / `maxNodes=300` / `hardMaxNodes=500` / `cacheTtlSeconds=600` / `timeoutMs=3000` / `model=""` / `centroidMode=mean`

## B. 后端 · 算法与接口

- [x] B1 `KnowledgeGraphService` + `KnowledgeGraphServiceImpl`：质心（mean/medoid）→ 单位化 → L2 → top-k → 连通分量 → 孤岛 → 簇
- [x] B2 规模保护：`N > maxNodes` 按一级目录聚合（簇节点 `id=-folderId`，根级 `-1`），`folderId` 参数下钻子树
- [x] B3 缓存（LRU 8 + TTL 10min，key=`model|maxUpdatedAt|docCount|maxNodes|folderId|centroidMode|includeUnvectorized`）+ 单飞 `ReentrantLock`
- [x] B4 3s 超时降级（独立单线程池 + `Future.get(3s)` → 目录聚合无图 + `degraded=true`）；降级结果**不写缓存**
- [x] B5 维度硬校验：向量维度与 `knowledge.embedding.dimensions` 不符时报错，禁止静默截断
- [x] B6 `KnowledgeController` 加 `GET /knowledge/graph`（`folderId` / `maxNodes`（硬上限 500）/ `includeUnvectorized`）
- [x] B7 `mvn -pl vc-app -am compile` 通过（JDK 21）

## C. 前端 · 地图

- [x] C1 `npm i react-force-graph-2d`（202KB / gzip 70KB，独立 chunk）
- [x] C2 `api/graph.ts`（契约类型 + `getKnowledgeGraph`）
- [x] C3 `pages/Knowledge/map/MapCanvas.tsx`（**只在文件内** `await import`，禁止 index 顶层 import；节点半径按 `chunkCount`、孤岛不发光、hover 邻居高亮、`cooldownTicks=90`）
- [x] C4 `pages/Knowledge/map/NodeDrawer.tsx`（摘要异步取 `getDoc`、关联 Top3、打开文档 / 就它提问 / 向量化）
- [x] C5 `pages/Knowledge/map/index.tsx`（工具栏 4 数字 + 模型 + 计算时间 + 目录下钻 + 仅看孤岛 + 重新计算；`seqRef` 丢弃过期响应；失败保留旧图）
- [x] C6 `map.css`（细进度条流光、抽屉 `translateX` 过渡、窄屏抽屉覆盖、不用 `transition: all`）
- [x] C7 `Knowledge/index.tsx` 加「文档 / 地图」pill + `?view=map` 分支；文档区 `visibility:hidden` 不卸载（保留树与编辑器）

## D. 闭环与降级

- [x] D1 抽屉「就它提问」→ `/chat?docs=<id>,...&prefill=...`；`Chat` 首帧解析并绑定到会话（无会话时新建「基于知识地图提问」并预置范围）
- [x] D2 窄屏 / 无 `requestAnimationFrame` 降级为列表视图（孤岛分组 + 未向量化 + 每篇 Top3 关联行）
- [x] D3 空图空态：区分「全未向量化」与「还没有文档」，给向量化引导

## E. 质量门

- [x] E1 `npx tsc --noEmit` exit 0；`npm run build` 通过
- [x] E2 真实库接口验证（`GET /api/knowledge/graph`）：
  - 全库：`model=qwen3.7-text-embedding-flash`、`docCount=2`、`nodes=1`、`edges=0`、`unvectorized=1`、`isolated=1`、`elapsed=37ms`
  - `includeUnvectorized=false` → 灰点 0；`maxNodes=500` 生效
  - `folderId=99999`（不存在）→ `code=0`、空图，不报错
  - **说明**：库内仅 1 篇已向量化文档，无法校准 `minSimilarity`（边数/孤岛比例），留待有更多文档后调配置，不改代码
- [ ] E3 UI 目测：星图渲染帧率、抽屉过渡、`view=doc` 时 Network 无 force-graph chunk（构建产物已确认独立 chunk，运行时需目测）

## 未完成 / 已知项

- `minSimilarity` / `centroidMode` 的真实数据校准（当前默认 0.55 / mean）
- UI 目测（本轮只做接口与构建验证）
- 回滚成本：删 `map/` 目录 + `Knowledge/index.tsx` 的 pill 分支 + 卸载依赖即可，后端删 `graph` 包与一个接口，无 DDL
