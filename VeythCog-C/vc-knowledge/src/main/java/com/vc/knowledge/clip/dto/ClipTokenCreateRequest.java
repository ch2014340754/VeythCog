package com.vc.knowledge.clip.dto;

import lombok.Data;

import java.io.Serializable;

/**
 * 新建剪藏令牌的请求。
 */
@Data
public class ClipTokenCreateRequest implements Serializable {

    /** 便于区分设备/用途，如"公司电脑 Chrome" */
    private String label;

    /** 生成书签脚本用的后端地址（本地开发传 http://localhost:8123/api；为空用配置默认值） */
    private String apiBase;
}
