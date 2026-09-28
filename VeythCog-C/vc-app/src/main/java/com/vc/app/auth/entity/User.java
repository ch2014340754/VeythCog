package com.vc.app.auth.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

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

    @Column(name = "create_time", insertable = false, updatable = false)
    private LocalDateTime createTime;
}
