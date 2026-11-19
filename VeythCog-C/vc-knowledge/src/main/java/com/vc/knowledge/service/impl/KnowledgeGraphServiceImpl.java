package com.vc.knowledge.service.impl;

import com.vc.common.exception.BusinessException;
import com.vc.common.exception.ErrorCode;
import com.vc.knowledge.config.KnowledgeProperties;
import com.vc.knowledge.dto.graph.DocChunkVector;
import com.vc.knowledge.dto.graph.DocMeta;
import com.vc.knowledge.dto.graph.GraphResponse;
import com.vc.knowledge.entity.KnowledgeFolder;
import com.vc.knowledge.mapper.KnowledgeDocMapper;
import com.vc.knowledge.mapper.KnowledgeEmbeddingMapper;
import com.vc.knowledge.mapper.KnowledgeFolderMapper;
import com.vc.knowledge.service.KnowledgeGraphService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Deque;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.locks.ReentrantLock;

/**
 * 知识地图实现：文档质心 → L2 相似 → top-k 近邻 → 连通分量 → 孤岛。
 *
 * <p>口径与 RAG 检索一致（pgvector L2，距离越小越相似），
 * sim = 1 - d / 2 只是把 d ∈ [0,2] 线性映射到 [0,1] 便于建阈值。</p>
 *
 * <p>不存 N×N 矩阵：只保留命中阈值的候选对，再按节点取 top-k，内存 O(N·K)。
 * 文档数超过 maxNodes 时按一级目录聚合为簇节点（id = -folderId），并标记 degraded。</p>
 */
@Slf4j
@Service
public class KnowledgeGraphServiceImpl implements KnowledgeGraphService {

    /** 目录路径最大回溯层数（防自引用环） */
    private static final int MAX_FOLDER_DEPTH = 8;
    /** 缓存最多保留的图数量 */
    private static final int CACHE_CAPACITY = 8;
    /** 缓存 key 中代表根级的伪目录 id */
    private static final long ROOT_GROUP_ID = -1L;

    private final KnowledgeDocMapper docMapper;
    private final KnowledgeEmbeddingMapper embeddingMapper;
    private final KnowledgeFolderMapper folderMapper;
    private final KnowledgeProperties properties;

    /** accessOrder LRU，容量 8；值为带计算时间的缓存项 */
    private final Map<String, CachedGraph> cache = Collections.synchronizedMap(
            new LinkedHashMap<>(16, 0.75f, true) {
                @Override
                protected boolean removeEldestEntry(Map.Entry<String, CachedGraph> eldest) {
                    return size() > CACHE_CAPACITY;
                }
            });

    /** 同 key 单飞：并发 10 次只算 1 次 */
    private final Map<String, ReentrantLock> locks = new ConcurrentHashMap<>();

    /** 独立单线程池：同一时刻只算一张图，避免和请求线程池互抢 */
    private final ExecutorService graphExecutor = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "knowledge-graph");
        t.setDaemon(true);
        return t;
    });

    public KnowledgeGraphServiceImpl(KnowledgeDocMapper docMapper,
                                     KnowledgeEmbeddingMapper embeddingMapper,
                                     KnowledgeFolderMapper folderMapper,
                                     KnowledgeProperties properties) {
        this.docMapper = docMapper;
        this.embeddingMapper = embeddingMapper;
        this.folderMapper = folderMapper;
        this.properties = properties;
    }

    @Override
    public GraphResponse graph(Long folderId, Integer maxNodes, boolean includeUnvectorized) {
        KnowledgeProperties.Graph cfg = properties.getGraph();
        int limit = resolveMaxNodes(cfg, maxNodes);
        List<Long> folderIds = folderId == null ? null : subtreeFolderIds(folderId);

        // 文档集合变化会立刻改变 maxUpdatedAt / docCount → 缓存 key 变化，无需手动失效
        List<DocMeta> vectorized = docMapper.selectDocMeta(true, folderIds);
        int totalDocs = (int) docMapper.countAll();
        String model = resolveModel();
        long maxUpdatedAt = vectorized.stream()
                .mapToLong(d -> d.getUpdatedAt() == null ? 0L : d.getUpdatedAt().toInstant().toEpochMilli())
                .max().orElse(0L);

        String cacheKey = String.join("|",
                model == null ? "-" : model,
                String.valueOf(maxUpdatedAt),
                String.valueOf(vectorized.size()),
                String.valueOf(limit),
                String.valueOf(folderId),
                cfg.getCentroidMode(),
                String.valueOf(includeUnvectorized));
        CachedGraph cached = cache.get(cacheKey);
        if (cached != null && !cached.expired(cfg.getCacheTtlSeconds())) {
            // 缓存命中：computedAt 保留上次计算时间，elapsedMs 归零（契约见 design §2.1）
            cached.response().getMeta().setElapsedMs(0L);
            return cached.response();
        }

        ReentrantLock lock = locks.computeIfAbsent(cacheKey, k -> new ReentrantLock());
        lock.lock();
        try {
            CachedGraph again = cache.get(cacheKey);
            if (again != null && !again.expired(cfg.getCacheTtlSeconds())) {
                again.response().getMeta().setElapsedMs(0L);
                return again.response();
            }
            long start = System.currentTimeMillis();
            GraphResponse response = computeWithTimeout(cfg, model, folderIds, vectorized, totalDocs,
                    limit, includeUnvectorized, start);
            // 计算失败/降级不写缓存（避免把空图钉死 10 分钟）
            if (!response.getMeta().isDegraded()) {
                cache.put(cacheKey, new CachedGraph(response, start));
            }
            return response;
        } finally {
            lock.unlock();
            locks.remove(cacheKey, lock);
        }
    }

    @Override
    public void invalidate() {
        cache.clear();
    }

    // ---------------------------------------------------------------- 计算

    private GraphResponse computeWithTimeout(KnowledgeProperties.Graph cfg,
                                             String model,
                                             List<Long> folderIds,
                                             List<DocMeta> vectorized,
                                             int totalDocs,
                                             int limit,
                                             boolean includeUnvectorized,
                                             long start) {
        if (model == null || vectorized.isEmpty()) {
            return emptyGraph(model, totalDocs, limit, includeUnvectorized, folderIds, 0L);
        }
        Future<GraphResponse> future = graphExecutor.submit(() -> {
            long t0 = System.currentTimeMillis();
            GraphResponse response = compute(cfg, model, folderIds, vectorized, totalDocs,
                    limit, includeUnvectorized);
            response.getMeta().setElapsedMs(System.currentTimeMillis() - t0);
            return response;
        });
        try {
            return future.get(cfg.getTimeoutMs(), TimeUnit.MILLISECONDS);
        } catch (TimeoutException e) {
            future.cancel(true);
            log.warn("knowledge graph 计算超时({}ms)，降级返回目录聚合图", cfg.getTimeoutMs());
            GraphResponse fallback = aggregateOnly(model, vectorized, totalDocs, limit);
            fallback.getMeta().setDegraded(true);
            fallback.getMeta().setComputedAt(start);
            fallback.getMeta().setElapsedMs(cfg.getTimeoutMs());
            return fallback;
        } catch (ExecutionException e) {
            Throwable cause = e.getCause();
            if (cause instanceof BusinessException be) {
                throw be;
            }
            log.error("knowledge graph 计算失败", cause);
            throw new BusinessException(ErrorCode.SYSTEM_ERROR, "知识地图计算失败，请稍后重试");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new BusinessException(ErrorCode.SYSTEM_ERROR, "知识地图计算被中断");
        }
    }

    private GraphResponse compute(KnowledgeProperties.Graph cfg,
                                  String model,
                                  List<Long> folderIds,
                                  List<DocMeta> docs,
                                  int totalDocs,
                                  int limit,
                                  boolean includeUnvectorized) {
        int dims = properties.getEmbedding().getDimensions();
        Map<Long, List<float[]>> chunksByDoc = loadChunks(model, folderIds, dims);

        // 1) 质心
        Map<Long, float[]> centroids = new LinkedHashMap<>();
        Map<Long, Integer> chunkCounts = new HashMap<>();
        for (DocMeta doc : docs) {
            List<float[]> chunks = chunksByDoc.get(doc.getId());
            if (chunks == null || chunks.isEmpty()) {
                continue;
            }
            float[] centroid = centroid(chunks, cfg.getCentroidMode());
            float[] unit = normalize(centroid);
            if (unit == null) {
                continue;
            }
            centroids.put(doc.getId(), unit);
            chunkCounts.put(doc.getId(), chunks.size());
        }

        GraphResponse response = new GraphResponse();
        GraphResponse.GraphMeta meta = response.getMeta();
        meta.setModel(model);
        meta.setDocCount(totalDocs);
        meta.setMaxNodes(limit);
        meta.setComputedAt(System.currentTimeMillis());

        if (centroids.isEmpty()) {
            fillUnvectorized(response, includeUnvectorized, folderIds);
            meta.setNodeCount(0);
            meta.setEdgeCount(0);
            return response;
        }

        // 2) 超限：按一级目录聚合
        if (centroids.size() > limit) {
            GraphResponse aggregated = aggregate(centroids, docs, chunkCounts, limit, cfg, totalDocs);
            GraphResponse.Islands islands = new GraphResponse.Islands();
            if (includeUnvectorized) {
                islands.getUnvectorized().addAll(unvectorizedNodes(folderIds));
            }
            aggregated.setIslands(islands);
            aggregated.getMeta().setComputedAt(meta.getComputedAt());
            return aggregated;
        }

        // 3) 正常：top-k 建边
        List<Long> ids = new ArrayList<>(centroids.keySet());
        Map<Long, DocMeta> docById = new HashMap<>();
        for (DocMeta doc : docs) {
            docById.put(doc.getId(), doc);
        }
        Map<Long, Integer> indexOf = new HashMap<>();
        for (int i = 0; i < ids.size(); i++) {
            indexOf.put(ids.get(i), i);
        }
        float[][] units = new float[ids.size()][];
        for (int i = 0; i < ids.size(); i++) {
            units[i] = centroids.get(ids.get(i));
        }

        double minSim = cfg.getMinSimilarity();
        int k = Math.max(1, cfg.getK());
        // 每个节点保留 top-k（小顶堆：堆顶是当前最差）
        Map<Long, List<Neighbor>> topK = new HashMap<>();
        for (Long id : ids) {
            topK.put(id, new ArrayList<>(k + 1));
        }
        for (int i = 0; i < units.length; i++) {
            for (int j = i + 1; j < units.length; j++) {
                double sim = similarity(units[i], units[j]);
                if (sim < minSim) {
                    continue;
                }
                offerTopK(topK.get(ids.get(i)), ids.get(j), sim, k);
                offerTopK(topK.get(ids.get(j)), ids.get(i), sim, k);
            }
        }

        // 合并去重成无向边
        Set<String> seen = new LinkedHashSet<>();
        Map<Long, List<Long>> adjacency = new HashMap<>();
        for (Long id : ids) {
            adjacency.put(id, new ArrayList<>());
        }
        for (Long source : ids) {
            for (Neighbor nb : topK.get(source)) {
                long a = Math.min(source, nb.target());
                long b = Math.max(source, nb.target());
                String key = a + "-" + b;
                if (!seen.add(key)) {
                    continue;
                }
                GraphResponse.GraphEdge edge = new GraphResponse.GraphEdge();
                edge.setSource(a);
                edge.setTarget(b);
                edge.setSimilarity(round3(nb.similarity()));
                edge.setSharedTags(sharedTags(docById.get(a), docById.get(b)));
                response.getEdges().add(edge);
                adjacency.get(a).add(b);
                adjacency.get(b).add(a);
            }
        }

        // 4) 连通分量
        Map<Long, Integer> clusterOf = new HashMap<>();
        List<List<Long>> components = new ArrayList<>();
        for (Long id : ids) {
            if (clusterOf.containsKey(id)) {
                continue;
            }
            int clusterId = components.size();
            List<Long> component = new ArrayList<>();
            Deque<Long> queue = new ArrayDeque<>();
            queue.add(id);
            clusterOf.put(id, clusterId);
            while (!queue.isEmpty()) {
                Long cur = queue.poll();
                component.add(cur);
                for (Long next : adjacency.get(cur)) {
                    if (!clusterOf.containsKey(next)) {
                        clusterOf.put(next, clusterId);
                        queue.add(next);
                    }
                }
            }
            components.add(component);
        }

        Map<Long, String> folderPaths = folderPaths();
        int maxChunk = chunkCounts.values().stream().mapToInt(Integer::intValue).max().orElse(1);
        List<Long> isolated = new ArrayList<>();
        for (Long id : ids) {
            DocMeta doc = docById.get(id);
            GraphResponse.GraphNode node = new GraphResponse.GraphNode();
            node.setId(id);
            node.setTitle(doc == null ? "未命名文档" : doc.getTitle());
            node.setFolderId(doc == null ? null : doc.getFolderId());
            node.setFolderPath(folderPath(folderPaths, doc == null ? null : doc.getFolderId()));
            node.setChunkCount(chunkCounts.getOrDefault(id, 0));
            node.setCharCount(doc == null ? 0 : doc.getCharCount());
            node.setVectorized(true);
            node.setDegree(adjacency.get(id).size());
            node.setClusterId(clusterOf.getOrDefault(id, 0));
            node.setColorKey(colorKey(node.getFolderId()));
            if (node.getDegree() == 0) {
                isolated.add(id);
            }
            response.getNodes().add(node);
        }

        // 5) 簇信息
        for (int i = 0; i < components.size(); i++) {
            List<Long> component = components.get(i);
            GraphResponse.GraphCluster cluster = new GraphResponse.GraphCluster();
            cluster.setId(i);
            cluster.setSize(component.size());
            Long hub = component.stream()
                    .max(java.util.Comparator.comparingInt(id -> adjacency.get(id).size()))
                    .orElse(component.get(0));
            DocMeta hubDoc = docById.get(hub);
            String label = hubDoc == null ? "未命名文档" : hubDoc.getTitle();
            cluster.setLabel(truncate(label, 12));
            Long folderId = hubDoc == null ? null : hubDoc.getFolderId();
            cluster.setFolderId(folderId);
            cluster.setColorKey(colorKey(folderId));
            response.getClusters().add(cluster);
        }

        GraphResponse.Islands islands = new GraphResponse.Islands();
        islands.setIsolated(isolated);
        if (includeUnvectorized) {
            islands.getUnvectorized().addAll(unvectorizedNodes(folderIds));
        }
        response.setIslands(islands);

        meta.setNodeCount(response.getNodes().size());
        meta.setEdgeCount(response.getEdges().size());
        return response;
    }

    // ---------------------------------------------------------------- 规模保护

    /** 按一级目录聚合为簇节点（节点 id = -folderId，根级 = -1） */
    private GraphResponse aggregate(Map<Long, float[]> centroids,
                                    List<DocMeta> docs,
                                    Map<Long, Integer> chunkCounts,
                                    int limit,
                                    KnowledgeProperties.Graph cfg,
                                    int totalDocs) {
        Map<Long, DocMeta> docById = new HashMap<>();
        for (DocMeta doc : docs) {
            docById.put(doc.getId(), doc);
        }
        Map<Long, String> folderPaths = folderPaths();
        Map<Long, KnowledgeFolder> folderById = folderIndex();

        // 组 = 一级目录（沿 parentId 上溯到根）
        Map<Long, List<Long>> groups = new LinkedHashMap<>();
        for (Long docId : centroids.keySet()) {
            DocMeta doc = docById.get(docId);
            Long rootId = rootFolderId(doc == null ? null : doc.getFolderId(), folderById);
            groups.computeIfAbsent(rootId == null ? ROOT_GROUP_ID : rootId, x -> new ArrayList<>()).add(docId);
        }

        // 组质心
        Map<Long, float[]> groupUnits = new LinkedHashMap<>();
        for (Map.Entry<Long, List<Long>> entry : groups.entrySet()) {
            float[] sum = null;
            for (Long docId : entry.getValue()) {
                float[] unit = centroids.get(docId);
                if (sum == null) {
                    sum = Arrays.copyOf(unit, unit.length);
                } else {
                    for (int i = 0; i < unit.length; i++) {
                        sum[i] += unit[i];
                    }
                }
            }
            if (sum == null) {
                continue;
            }
            float[] unit = normalize(sum);
            if (unit != null) {
                groupUnits.put(entry.getKey(), unit);
            }
        }

        List<Long> groupIds = new ArrayList<>(groupUnits.keySet());
        Map<Long, Integer> groupDegree = new HashMap<>();
        for (Long g : groupIds) {
            groupDegree.put(g, 0);
        }
        int k = Math.max(1, cfg.getK());
        Map<Long, List<Neighbor>> topK = new HashMap<>();
        for (Long g : groupIds) {
            topK.put(g, new ArrayList<>(k + 1));
        }
        for (int i = 0; i < groupIds.size(); i++) {
            for (int j = i + 1; j < groupIds.size(); j++) {
                double sim = similarity(groupUnits.get(groupIds.get(i)), groupUnits.get(groupIds.get(j)));
                if (sim < cfg.getMinSimilarity()) {
                    continue;
                }
                offerTopK(topK.get(groupIds.get(i)), groupIds.get(j), sim, k);
                offerTopK(topK.get(groupIds.get(j)), groupIds.get(i), sim, k);
            }
        }

        GraphResponse response = new GraphResponse();
        GraphResponse.GraphMeta meta = response.getMeta();
        meta.setDocCount(totalDocs);
        meta.setMaxNodes(limit);
        meta.setDegraded(true);

        Set<String> seen = new LinkedHashSet<>();
        for (Long g : groupIds) {
            for (Neighbor nb : topK.get(g)) {
                long a = Math.min(g, nb.target());
                long b = Math.max(g, nb.target());
                if (!seen.add(a + "-" + b)) {
                    continue;
                }
                GraphResponse.GraphEdge edge = new GraphResponse.GraphEdge();
                edge.setSource(-a);
                edge.setTarget(-b);
                edge.setSimilarity(round3(nb.similarity()));
                response.getEdges().add(edge);
                groupDegree.merge(g, 1, Integer::sum);
                groupDegree.merge(nb.target(), 1, Integer::sum);
            }
        }

        for (Long g : groupIds) {
            GraphResponse.GraphNode node = new GraphResponse.GraphNode();
            node.setId(-g);
            Long folderId = g == ROOT_GROUP_ID ? null : g;
            node.setTitle(folderId == null
                    ? "根目录"
                    : truncate(rootFolderName(folderId, folderPaths), 12));
            node.setFolderId(folderId);
            node.setFolderPath(folderPath(folderPaths, folderId));
            node.setChunkCount(groups.getOrDefault(g, List.of()).size());
            node.setCharCount(0);
            node.setVectorized(true);
            node.setDegree(groupDegree.getOrDefault(g, 0));
            node.setClusterId(0);
            node.setColorKey(colorKey(folderId));
            response.getNodes().add(node);

            GraphResponse.GraphCluster cluster = new GraphResponse.GraphCluster();
            cluster.setId(response.getClusters().size());
            cluster.setLabel(node.getTitle());
            cluster.setSize(node.getChunkCount());
            cluster.setFolderId(folderId);
            cluster.setColorKey(node.getColorKey());
            response.getClusters().add(cluster);
        }

        meta.setNodeCount(response.getNodes().size());
        meta.setEdgeCount(response.getEdges().size());
        return response;
    }

    /** 超时兜底：只按目录聚合、不建边（计算量为 0，几乎立刻返回） */
    private GraphResponse aggregateOnly(String model, List<DocMeta> docs, int totalDocs, int limit) {
        GraphResponse response = new GraphResponse();
        GraphResponse.GraphMeta meta = response.getMeta();
        meta.setModel(model);
        meta.setDocCount(totalDocs);
        meta.setMaxNodes(limit);

        Map<Long, Integer> groupSize = new LinkedHashMap<>();
        Map<Long, KnowledgeFolder> folderById = folderIndex();
        for (DocMeta doc : docs) {
            Long root = rootFolderId(doc.getFolderId(), folderById);
            groupSize.merge(root == null ? ROOT_GROUP_ID : root, 1, Integer::sum);
        }
        Map<Long, String> folderPaths = folderPaths();
        for (Map.Entry<Long, Integer> entry : groupSize.entrySet()) {
            GraphResponse.GraphNode node = new GraphResponse.GraphNode();
            node.setId(-entry.getKey());
            Long folderId = entry.getKey() == ROOT_GROUP_ID ? null : entry.getKey();
            node.setTitle(folderId == null ? "根目录" : truncate(rootFolderName(folderId, folderPaths), 12));
            node.setFolderId(folderId);
            node.setFolderPath(folderPath(folderPaths, folderId));
            node.setChunkCount(entry.getValue());
            node.setVectorized(true);
            node.setColorKey(colorKey(folderId));
            response.getNodes().add(node);
        }
        meta.setNodeCount(response.getNodes().size());
        meta.setEdgeCount(0);
        return response;
    }

    // ---------------------------------------------------------------- 数据准备

    private Map<Long, List<float[]>> loadChunks(String model, List<Long> folderIds, int dims) {
        List<DocChunkVector> rows = embeddingMapper.selectVectorsByModel(model, folderIds);
        Map<Long, List<float[]>> byDoc = new LinkedHashMap<>();
        for (DocChunkVector row : rows) {
            float[] embedding = row.getEmbedding();
            if (embedding == null) {
                continue;
            }
            if (embedding.length != dims) {
                throw new BusinessException(ErrorCode.SYSTEM_ERROR,
                        "向量维度为 " + embedding.length + "，与配置 " + dims + " 不一致：向量模型变更后需重新向量化");
            }
            byDoc.computeIfAbsent(row.getDocId(), k -> new ArrayList<>()).add(embedding);
        }
        return byDoc;
    }

    private void fillUnvectorized(GraphResponse response, boolean includeUnvectorized, List<Long> folderIds) {
        GraphResponse.Islands islands = new GraphResponse.Islands();
        if (includeUnvectorized) {
            islands.getUnvectorized().addAll(unvectorizedNodes(folderIds));
        }
        response.setIslands(islands);
    }

    private List<GraphResponse.GraphNode> unvectorizedNodes(List<Long> folderIds) {
        List<DocMeta> docs = docMapper.selectDocMeta(false, folderIds);
        Map<Long, String> folderPaths = folderPaths();
        List<GraphResponse.GraphNode> nodes = new ArrayList<>(docs.size());
        for (DocMeta doc : docs) {
            GraphResponse.GraphNode node = new GraphResponse.GraphNode();
            node.setId(doc.getId());
            node.setTitle(doc.getTitle());
            node.setFolderId(doc.getFolderId());
            node.setFolderPath(folderPath(folderPaths, doc.getFolderId()));
            node.setChunkCount(0);
            node.setCharCount(doc.getCharCount());
            node.setVectorized(false);
            node.setDegree(0);
            node.setClusterId(-1);
            node.setColorKey(colorKey(doc.getFolderId()));
            nodes.add(node);
        }
        return nodes;
    }

    private GraphResponse emptyGraph(String model, int totalDocs, int limit, boolean includeUnvectorized,
                                     List<Long> folderIds, long start) {
        GraphResponse response = new GraphResponse();
        GraphResponse.GraphMeta meta = response.getMeta();
        meta.setModel(model);
        meta.setDocCount(totalDocs);
        meta.setMaxNodes(limit);
        meta.setComputedAt(start);
        fillUnvectorized(response, includeUnvectorized, folderIds);
        return response;
    }

    private String resolveModel() {
        String configured = properties.getGraph().getModel();
        if (configured != null && !configured.isBlank()) {
            return configured.trim();
        }
        return embeddingMapper.selectDominantModel();
    }

    private int resolveMaxNodes(KnowledgeProperties.Graph cfg, Integer requested) {
        if (requested == null || requested <= 0) {
            return cfg.getMaxNodes();
        }
        return Math.min(requested, cfg.getHardMaxNodes());
    }

    /** 下钻：该目录及其全部子孙目录 id（含自身） */
    private List<Long> subtreeFolderIds(Long folderId) {
        List<KnowledgeFolder> folders = folderMapper.selectList(null);
        Map<Long, List<Long>> children = new HashMap<>();
        for (KnowledgeFolder folder : folders) {
            Long parentId = folder.getParentId();
            children.computeIfAbsent(parentId == null ? 0L : parentId, k -> new ArrayList<>()).add(folder.getId());
        }
        List<Long> result = new ArrayList<>();
        Deque<Long> queue = new ArrayDeque<>();
        queue.add(folderId);
        while (!queue.isEmpty()) {
            Long current = queue.poll();
            result.add(current);
            queue.addAll(children.getOrDefault(current, List.of()));
        }
        return result;
    }

    /** folderId → "技术/中间件"（根级 "/"） */
    private Map<Long, String> folderPaths(Map<Long, KnowledgeFolder> byId) {
        Map<Long, String> paths = new HashMap<>();
        for (KnowledgeFolder folder : byId.values()) {
            paths.put(folder.getId(), buildPath(folder, byId));
        }
        return paths;
    }

    private Map<Long, String> folderPaths() {
        return folderPaths(folderIndex());
    }

    /** 全量目录索引（一次 SQL，禁用循环内查询） */
    private Map<Long, KnowledgeFolder> folderIndex() {
        List<KnowledgeFolder> folders = folderMapper.selectList(null);
        Map<Long, KnowledgeFolder> byId = new HashMap<>();
        for (KnowledgeFolder folder : folders) {
            byId.put(folder.getId(), folder);
        }
        return byId;
    }

    private String buildPath(KnowledgeFolder folder, Map<Long, KnowledgeFolder> byId) {
        Deque<String> names = new ArrayDeque<>();
        KnowledgeFolder current = folder;
        int depth = 0;
        Set<Long> visited = new LinkedHashSet<>();
        while (current != null && depth++ < MAX_FOLDER_DEPTH) {
            if (!visited.add(current.getId())) {
                break;
            }
            names.addFirst(current.getName());
            Long parentId = current.getParentId();
            current = parentId == null ? null : byId.get(parentId);
        }
        return String.join("/", names);
    }

    private String folderPath(Map<Long, String> paths, Long folderId) {
        if (folderId == null) {
            return "/";
        }
        String path = paths.get(folderId);
        return path == null || path.isBlank() ? "/" : path;
    }

    /** 沿 parentId 上溯到一级目录；根级返回 null */
    private Long rootFolderId(Long folderId, Map<Long, KnowledgeFolder> byId) {
        if (folderId == null) {
            return null;
        }
        KnowledgeFolder current = byId.get(folderId);
        int depth = 0;
        Set<Long> visited = new LinkedHashSet<>();
        while (current != null && depth++ < MAX_FOLDER_DEPTH) {
            if (!visited.add(current.getId())) {
                return null;
            }
            if (current.getParentId() == null) {
                return current.getId();
            }
            current = byId.get(current.getParentId());
        }
        return folderId;
    }

    private String rootFolderName(Long rootId, Map<Long, String> paths) {
        String path = paths.get(rootId);
        if (path == null) {
            return "未分类";
        }
        int slash = path.indexOf('/');
        return slash < 0 ? path : path.substring(0, slash);
    }

    // ---------------------------------------------------------------- 数学

    private float[] centroid(List<float[]> chunks, String mode) {
        float[] sum = new float[chunks.get(0).length];
        for (float[] chunk : chunks) {
            for (int i = 0; i < chunk.length; i++) {
                sum[i] += chunk[i];
            }
        }
        for (int i = 0; i < sum.length; i++) {
            sum[i] /= chunks.size();
        }
        if ("medoid".equalsIgnoreCase(mode) && chunks.size() > 1) {
            float[] best = chunks.get(0);
            double bestDist = Double.MAX_VALUE;
            for (float[] chunk : chunks) {
                double d = distance(normalize(chunk), normalize(sum));
                if (d < bestDist) {
                    bestDist = d;
                    best = chunk;
                }
            }
            return best;
        }
        return sum;
    }

    private float[] normalize(float[] vector) {
        double norm = 0;
        for (float value : vector) {
            norm += (double) value * value;
        }
        norm = Math.sqrt(norm);
        if (norm < 1e-9) {
            return null;
        }
        float[] out = new float[vector.length];
        for (int i = 0; i < vector.length; i++) {
            out[i] = (float) (vector[i] / norm);
        }
        return out;
    }

    private double distance(float[] a, float[] b) {
        if (a == null || b == null) {
            return 2.0;
        }
        double sum = 0;
        for (int i = 0; i < a.length; i++) {
            double diff = (double) a[i] - b[i];
            sum += diff * diff;
        }
        return Math.sqrt(sum);
    }

    /** sim = 1 - L2 / 2 ∈ [0,1]（输入须为单位向量） */
    private double similarity(float[] a, float[] b) {
        return 1.0 - Math.min(distance(a, b), 2.0) / 2.0;
    }

    private void offerTopK(List<Neighbor> heap, Long target, double sim, int k) {
        if (heap.size() < k) {
            heap.add(new Neighbor(target, sim));
            heap.sort(java.util.Comparator.comparingDouble(Neighbor::similarity));
            return;
        }
        // 堆内（此处为升序列表）：首项是当前最差
        if (heap.get(0).similarity() < sim) {
            heap.remove(0);
            heap.add(new Neighbor(target, sim));
            heap.sort(java.util.Comparator.comparingDouble(Neighbor::similarity));
        }
    }

    private List<String> sharedTags(DocMeta a, DocMeta b) {
        if (a == null || b == null || a.getTags() == null || b.getTags() == null) {
            return List.of();
        }
        Set<String> tagsA = new LinkedHashSet<>(Arrays.asList(a.getTags()));
        List<String> shared = new ArrayList<>();
        for (String tag : b.getTags()) {
            if (tagsA.contains(tag) && !shared.contains(tag)) {
                shared.add(tag);
            }
        }
        return shared;
    }

    private int colorKey(Long folderId) {
        int hash = folderId == null ? 0 : Long.hashCode(folderId);
        return Math.abs(hash) % 8;
    }

    private double round3(double value) {
        return Math.round(value * 1000.0) / 1000.0;
    }

    private String truncate(String text, int max) {
        if (text == null) {
            return "未命名文档";
        }
        return text.length() <= max ? text : text.substring(0, max);
    }

    /** 近邻（target=对端 id，similarity=0-1） */
    private record Neighbor(Long target, double similarity) {
    }

    /** 缓存项：响应 + 计算完成时间 */
    private record CachedGraph(GraphResponse response, long savedAt) {
        boolean expired(int ttlSeconds) {
            return System.currentTimeMillis() - savedAt > ttlSeconds * 1000L;
        }
    }
}
