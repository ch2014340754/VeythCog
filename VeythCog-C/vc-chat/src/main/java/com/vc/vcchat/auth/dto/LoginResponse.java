package com.vc.vcchat.auth.dto;

import lombok.Data;

import java.io.Serializable;

@Data
public class LoginResponse implements Serializable {

    /** JWT token */
    private String token;

    private String username;

    private String nickname;
}
