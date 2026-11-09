package com.vc.app.orchestration;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 文档元数据（摘要 / 标签）——由辅助模型生成。
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class DocMetadata {
    private String summary;
    private List<String> tags;
}
