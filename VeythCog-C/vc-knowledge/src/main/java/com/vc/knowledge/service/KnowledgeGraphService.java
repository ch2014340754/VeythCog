package com.vc.knowledge.service;

import com.vc.knowledge.dto.graph.GraphResponse;

 /**
 * 知识地图（结构总览 + 语义星图 + 孤岛）。
 */
public interface KnowledgeGraphService {

    /**
     * 计算/取缓存一张知识地图。
     *
     * @param folderId            下钻目录（null = 全库）
     * @param maxNodes            本次节点上限（null = 配置值，硬上限见配置）
     * @param includeUnvectorized 是否下发未向量化灰点清单
     */
    GraphResponse graph(Long folderId, Integer maxNodes, boolean includeUnvectorized);

    /** 主动失效缓存（文档增删改、向量化后调用） */
    void invalidate();
}
