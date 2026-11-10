package com.vc.nav.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serializable;
import java.time.OffsetDateTime;

/**
 * 导航分类表实体（对应 nav_category 表）。
 * 右侧竖栏分类：主页 / 后端 / 前端 / 学习 / 工具 / 游戏 / AI。
 */
@Data
@TableName("nav_category")
public class NavCategory implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 所属用户 */
    private Long userId;

    /** 分类名（主页 / 后端 / 前端 ...） */
    private String name;

    /** 分类图标（P0 用 emoji，如 🏠 </>） */
    private String icon;

    /** 排序值，越小越靠前 */
    private Integer sortOrder;

    /** 是否默认分类（应用层保证每用户至多 1 个 true） */
    private Boolean isDefault;

    @TableLogic(value = "false", delval = "true")
    private Boolean deleted;

    private OffsetDateTime createdAt;

    private OffsetDateTime updatedAt;
}
