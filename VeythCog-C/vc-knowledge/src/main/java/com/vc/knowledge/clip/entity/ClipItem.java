package com.vc.knowledge.clip.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import com.vc.knowledge.handler.StringArrayTypeHandler;
import lombok.Data;

import java.io.Serializable;
import java.time.OffsetDateTime;

/**
 * 收件箱条目（对应 clip_item 表）。
 *
 * <p>定位是"剪藏进来的待处理内容"：先落在这里，是否变成知识库文档由用户决定。
 * {@code contentMd} 是权威正文（HTML 只是审计用，可清空）。</p>
 */
@Data
@TableName("clip_item")
public class ClipItem implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 归属账号：列表/详情/更新/删除全部以它为作用域 */
    private Long ownerId;

    /** 原始链接（书签脚本上报时可能为空） */
    private String url;

    /** 来源域名，列表展示用 */
    private String site;

    private String title;

    /** 作者 / 站点名 */
    private String byline;

    /** 正文前 200 字，列表预览用 */
    private String excerpt;

    /** 清洗后的 Markdown（权威格式，供预览/入库/检索） */
    private String contentMd;

    /** 原始 HTML，仅"查看原文"折叠区使用，可清空 */
    private String rawHtml;

    private Integer wordCount;

    /** ok / fallback（fallback = 没提到正文，用整页可读文本兜底） */
    private String quality;

    /** url / bookmarklet / extension / manual */
    private String channel;

    /** pending / archived / dropped */
    private String status;

    /** 抓取失败原因，非空即失败（列表据此展示"重试"） */
    private String error;

    @TableField(typeHandler = StringArrayTypeHandler.class)
    private String[] tags;

    /** 入库后的 knowledge_doc id */
    private Long docId;

    private OffsetDateTime createdAt;

    private OffsetDateTime updatedAt;

    @TableLogic(value = "false", delval = "true")
    private Boolean deleted;
}
