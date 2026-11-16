package com.vc.knowledge.clip.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serializable;
import java.time.OffsetDateTime;

/**
 * 剪藏令牌（对应 clip_token 表）。
 *
 * <p>书签脚本运行在第三方域名，拿不到 localStorage 里的 JWT，所以用这张表签发
 * <b>只可写</b> 的长期令牌：明文只在生成时返回一次，库里只留 SHA-256。</p>
 */
@Data
@TableName("clip_token")
public class ClipToken implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long ownerId;

    /** SHA-256(token) 小写十六进制 */
    private String tokenHash;

    private String label;

    private OffsetDateTime createdAt;

    private OffsetDateTime lastUsedAt;

    private Boolean revoked;
}
