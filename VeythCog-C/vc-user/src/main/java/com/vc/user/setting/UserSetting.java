package com.vc.user.setting;

import com.baomidou.mybatisplus.annotation.FieldStrategy;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serializable;
import java.time.OffsetDateTime;

/**
 * 用户偏好统一表实体（对应 user_setting，一人一行，主键 user_id）。
 *
 * <p>新增偏好时在此加字段 + {@link com.vc.user.setting.dto.UserSettingView} 加下发字段
 * + {@link com.vc.user.setting.dto.UserSettingPatch} 加更新字段即可，不再新建表。</p>
 */
@Data
@TableName("user_setting")
public class UserSetting implements Serializable {

    /** 所属用户（主键） */
    @TableId
    private Long userId;

    /** 默认搜索引擎（baidu / google / bing） */
    private String searchEngine;

    /**
     * 锁定的壁纸 S3 key；null = 每次进入首页随机。
     * <p>updateStrategy=ALWAYS：允许把值改回 NULL（解锁）。MyBatis-Plus 默认 NOT_NULL 策略会跳过 null 字段，
     * 导致「解锁」写不进库。读取时始终先整行 selectById，再改目标字段，所以整行覆盖是安全的。</p>
     */
    @TableField(updateStrategy = FieldStrategy.ALWAYS)
    private String currentWallpaperKey;

    /** 上次选中的导航分类；updateStrategy=ALWAYS 理由同上（允许清空） */
    @TableField(updateStrategy = FieldStrategy.ALWAYS)
    private Long activeCategoryId;

    /** 首页默认视图：today / nav（服务层白名单校验，非法值按 today 处理） */
    private String homeView;

    private OffsetDateTime createdAt;

    private OffsetDateTime updatedAt;
}
