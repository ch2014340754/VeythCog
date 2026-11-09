package com.vc.llm.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * 辅助小模型配置（llm.aux-model.*）。
 *
 * <p>用于两类"不需要用户选择模型"的后台任务：知识库文档摘要/标签生成、RAG 检索结果 rerank。
 * 与对话模型解耦，便于单独换成更便宜/更快的小模型。</p>
 */
@Data
@Component
@ConfigurationProperties(prefix = "llm.aux-model")
public class AuxModelProps {

    /** 厂商标识，如 dashscope */
    private String vendor = "dashscope";

    /** 模型编码，如 qwen-turbo */
    private String modelCode = "qwen-turbo";

    /** 采样温度：元数据抽取 / rerank 需要稳定结果，默认接近 0 */
    private double temperature = 0.1;

    /** 单次输入正文最大字符数，超出截断，控制 token 成本 */
    private int maxInputChars = 3000;
}
