package com.vc.nav.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serializable;
import java.time.OffsetDateTime;

/**
 * 用户导航首页配置表实体（对应 nav_setting 表，一人一行）。
 */
@Data
@TableName("nav_setting")
public class NavSetting implements Serializable {

    /** 所属用户（主键） */
    @TableId
    private Long userId;

    /** 默认搜索引擎（baidu / google / bing） */
    private String searchEngine;

    /** 锁定的壁纸 S3 key；null = 每次进入首页随机 */
    private String currentWallpaperKey;

    /** 上次选中的分类（进入首页时恢复） */
    private Long activeCategoryId;

    private OffsetDateTime updatedAt;
}
