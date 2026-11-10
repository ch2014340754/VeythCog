package com.vc.nav.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serializable;
import java.time.OffsetDateTime;

/**
 * 导航书签表实体（对应 nav_bookmark 表）。
 * 图标不存库：前端每次渲染时根据 url 实时拼 https://{host}/favicon.ico。
 */
@Data
@TableName("nav_bookmark")
public class NavBookmark implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 所属分类 */
    private Long categoryId;

    /** 所属用户（冗余，便于按用户查询） */
    private Long userId;

    /** 显示名（GitHub / MDN / React） */
    private String title;

    /** 跳转地址（后端校验仅 http/https） */
    private String url;

    /** 分类内排序值，越小越靠前 */
    private Integer sortOrder;

    @TableLogic(value = "false", delval = "true")
    private Boolean deleted;

    private OffsetDateTime createdAt;

    private OffsetDateTime updatedAt;
}
