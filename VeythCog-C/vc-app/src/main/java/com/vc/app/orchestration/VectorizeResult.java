package com.vc.app.orchestration;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 向量化结果：分片数 + 回传本次自动补齐的元数据（前端可直接更新，无需再拉详情）。
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class VectorizeResult {
    private int chunkCount;
    private String summary;
    private List<String> tags;
}
