package com.vc.app.auth.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.Table;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.Set;

/**
 * 用户实体 → app_user 表（避开 user 保留字）。
 * password 存 BCrypt 密文，绝不存明文。
 */
@Data
@Entity
@Table(name = "app_user")
public class User implements Serializable {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 64)
    private String username;

    @Column(nullable = false, length = 128)
    private String password;

    @Column(nullable = false, length = 64)
    private String nickname = "";

    @Column(length = 128)
    private String email = "";

    /** 头像 S3 对象 key；展示时由后端生成公开直链 */
    @Column(name = "avatar_key", length = 512)
    private String avatarKey = "";

    /** 状态：active / disabled */
    @Column(length = 16)
    private String status = "active";

    /** 角色：多对多（通过 user_role 关联表） */
    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
        name = "user_role",
        joinColumns = @JoinColumn(name = "user_id"),
        inverseJoinColumns = @JoinColumn(name = "role_id")
    )
    private Set<Role> roles;

    @Column(name = "create_time", insertable = false, updatable = false)
    private LocalDateTime createTime;
}
