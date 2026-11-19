package com.vc.knowledge.dto.graph;

import lombok.Data;

/**
 * 分片向量行（只承载 SQL 结果，必须走 resultMap + VectorTypeHandler）。
 */
@Data
public class DocChunkVector {

    private Long docId;

    private float[] embedding;
}
