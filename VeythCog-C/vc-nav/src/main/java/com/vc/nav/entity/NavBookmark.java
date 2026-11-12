package com.vc.nav.entity;

import com.baomidou.mybatisplus.annotation.FieldStrategy;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serializable;
import java.time.OffsetDateTime;

/**
 * 导航书签表实体（对应 nav_bookmark 表）。
 *
 * <p>图标资产化（013 起）：站点图标 / 自定义上传图标统一存 S3 {@code public-icons}，
 * 库里只保留对象 key；文字图标直接存文字与底色，不产生 S3 对象。</p>
 */
@Data
@TableName("nav_bookmark")
public class NavBookmark implements Serializable {

    /** 图标来源：站点自动抓取 */
    public static final String ICON_TYPE_AUTO = "auto";
    /** 图标来源：用户上传 */
    public static final String ICON_TYPE_UPLOAD = "upload";
    /** 图标来源：文字图标 */
    public static final String ICON_TYPE_TEXT = "text";

    /** 默认文字图标底色（与前端预设色第一项一致） */
    public static final String DEFAULT_ICON_COLOR = "#3B82F6";

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

    /**
     * 图标来源：auto / upload / text。
     * <p>updateStrategy=ALWAYS：更新时把字段原样写入（含 null），
     * 否则 MyBatis-Plus 默认忽略 null，切换图标类型时无法清空旧值。</p>
     */
    @TableField(updateStrategy = FieldStrategy.ALWAYS)
    private String iconType;

    /** public-icons 对象 key（icons/yyyy/MM/dd/uuid.ext）；文字图标为空 */
    @TableField(updateStrategy = FieldStrategy.ALWAYS)
    private String iconKey;

    /** 文字图标内容（1~3 字符）；图片图标为空 */
    @TableField(updateStrategy = FieldStrategy.ALWAYS)
    private String iconText;

    /** 文字图标底色（#RRGGBB）；图片图标为空 */
    @TableField(updateStrategy = FieldStrategy.ALWAYS)
    private String iconColor;

    /** 最近一次站点图标抓取时间（成功/失败都写，失败按 1 天冷却重试） */
    @TableField(updateStrategy = FieldStrategy.ALWAYS)
    private OffsetDateTime iconSyncedAt;

    /** 分类内排序值，越小越靠前 */
    private Integer sortOrder;

    @TableLogic(value = "false", delval = "true")
    private Boolean deleted;

    private OffsetDateTime createdAt;

    private OffsetDateTime updatedAt;
}
