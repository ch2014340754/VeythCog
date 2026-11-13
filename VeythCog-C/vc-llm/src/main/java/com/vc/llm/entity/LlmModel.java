package com.vc.llm.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Data;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 模型目录实体 → llm_model 表（属于某供应商）。
 */
@Data
@Entity
@Table(name = "llm_model",
        uniqueConstraints = @UniqueConstraint(name = "uk_vendor_model", columnNames = {"vendor_code", "model_code"}))
public class LlmModel implements Serializable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "vendor_code", nullable = false, length = 32)
    private String vendorCode;

    @Column(name = "model_code", nullable = false, length = 64)
    private String modelCode;

    @Column(name = "model_name", nullable = false, length = 64)
    private String modelName;

    /** 模型主类型（text / reasoning / vision / omni / image / video / audio / embedding / other） */
    @Column(name = "model_type", nullable = false, length = 32)
    private String modelType = "text";

    /** 模型支持的全部模态，逗号分隔的 ModelType code；modelType 只是其中的主类型 */
    @Column(name = "modalities", length = 255)
    private String modalities = "text";

    @Column(name = "max_context_tokens")
    private Integer maxContextTokens = 32768;

    private BigDecimal temperature = new BigDecimal("0.70");

    private Boolean enabled = true;

    @Column(name = "create_time", insertable = false, updatable = false)
    private LocalDateTime createTime;
}
