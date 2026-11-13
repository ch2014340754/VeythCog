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

    /**
     * 用户自持 API Key 的 AES-256-GCM 密文（base64(iv):base64(ct)）。
     * <p>语义为「用户 + 供应商」级：同一 vendor 下所有绑定行共享同一份密文；
     * 为 NULL 时回落到配置文件 llm.vendors.*.api-key。</p>
     */
    @Column(name = "api_key_cipher")
    private String apiKeyCipher;

    /** 最近一次写入用户 AK 的时间 */
    @Column(name = "api_key_updated_at")
    private LocalDateTime apiKeyUpdatedAt;

    /**
     * 百炼业务空间 ID（如 llm-xxxx）。语义同 AK：同一 user + vendor 下所有绑定行共享；
     * 为 NULL 时回落到 llm.vendors.dashscope.workspace-id。
     */
    @Column(name = "workspace_id", length = 64)
    private String workspaceId;

    /** 百炼地域代码（如 cn-beijing）；为空回落配置或默认 cn-beijing */
    @Column(name = "region", length = 32)
    private String region;

    /** 是否通过连通校验；只有 true 的绑定可出现在对话模型下拉 */
    @Column(name = "is_valid", nullable = false)
    private Boolean isValid = false;

    /** 最近一次连通校验时间 */
    @Column(name = "last_verify_at")
    private LocalDateTime lastVerifyAt;

    /** 最近一次校验失败原因（成功为 null） */
    @Column(name = "verify_error", length = 300)
    private String verifyError;
}
