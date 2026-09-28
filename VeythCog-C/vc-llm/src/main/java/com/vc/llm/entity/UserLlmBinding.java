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
import java.time.LocalDateTime;

/**
 * 用户-模型绑定中间表实体 → user_llm_binding。
 */
@Data
@Entity
@Table(name = "user_llm_binding",
        uniqueConstraints = @UniqueConstraint(name = "uk_user_vendor_model",
                columnNames = {"user_id", "vendor_code", "model_code"}))
public class UserLlmBinding implements Serializable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "vendor_code", nullable = false, length = 32)
    private String vendorCode;

    @Column(name = "model_code", nullable = false, length = 64)
    private String modelCode;

    @Column(name = "is_default")
    private Boolean isDefault = false;

    private Boolean enabled = true;

    @Column(name = "create_time", insertable = false, updatable = false)
    private LocalDateTime createTime;
}
