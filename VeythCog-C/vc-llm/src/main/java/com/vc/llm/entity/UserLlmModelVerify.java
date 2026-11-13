package com.vc.llm.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 单模型连通校验记录 → user_llm_model_verify。
 *
 * <p>与绑定解耦：用户可以先校验、再决定是否绑定。{@code keyFingerprint} 记录校验时实际使用的
 * Key 指纹，对话时有效 Key 不一致则结论作废，避免「换 Key 后沿用旧结论」。</p>
 */
@Data
@Entity
@Table(name = "user_llm_model_verify",
        uniqueConstraints = @UniqueConstraint(name = "uk_user_model_verify",
                columnNames = {"user_id", "vendor_code", "model_code"}))
public class UserLlmModelVerify implements Serializable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "vendor_code", nullable = false, length = 32)
    private String vendorCode;

    @Column(name = "model_code", nullable = false, length = 64)
    private String modelCode;

    @Column(name = "is_valid", nullable = false)
    private Boolean isValid = false;

    /** 校验时实际使用 Key 的指纹（SHA-256 前 8 位） */
    @Column(name = "key_fingerprint", length = 32)
    private String keyFingerprint;

    @Column(name = "verify_error", length = 300)
    private String verifyError;

    @Column(name = "last_verify_at")
    private LocalDateTime lastVerifyAt;

    @Column(name = "create_time", insertable = false, updatable = false)
    private LocalDateTime createTime;

    @Column(name = "update_time")
    private LocalDateTime updateTime;

    @PrePersist
    void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        if (updateTime == null) {
            updateTime = now;
        }
    }

    @PreUpdate
    void onUpdate() {
        updateTime = LocalDateTime.now();
    }
}
