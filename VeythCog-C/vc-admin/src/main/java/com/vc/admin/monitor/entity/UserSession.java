package com.vc.admin.monitor.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 登录会话 → sys_user_session。
 *
 * <p>JWT 无状态，但要支持「在线会话 + 强制下线」，就必须有一个可吊销的会话记录：
 * 登录时生成 sid 并写库，JWT 携带 sid，鉴权时校验 status。踢人 = 把 status 置 kicked，
 * 下一次请求即被拒绝（无需等 token 过期）。</p>
 */
@Data
@Entity
@Table(name = "sys_user_session")
public class UserSession {

    /** 会话 id（UUID），同时是 JWT 的 sid 声明 */
    @Id
    @Column(length = 36)
    private String sid;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(length = 64)
    private String username;

    @Column(length = 64)
    private String ip;

    @Column(name = "user_agent", length = 300)
    private String userAgent;

    @Column(name = "login_at", nullable = false)
    private LocalDateTime loginAt;

    @Column(name = "last_active_at", nullable = false)
    private LocalDateTime lastActiveAt;

    /** active / kicked / logout / expired */
    @Column(length = 16, nullable = false)
    private String status = "active";

    @Column(name = "kicked_at")
    private LocalDateTime kickedAt;

    @Column(name = "kicked_by")
    private Long kickedBy;
}
