package com.vc.music.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import com.vc.music.handler.JsonbTypeHandler;
import com.vc.music.handler.StringArrayTypeHandler;
import lombok.Data;

import java.io.Serializable;
import java.time.OffsetDateTime;

/**
 * 音乐曲库实体（对应 {@code music_track} 表）。
 *
 * <p>两个非标准列需要显式类型处理器：{@code tags} 是 PostgreSQL {@code text[]}，
 * {@code cover_color} 是 {@code jsonb}（JDBC 默认会把 String 按 varchar 绑定，必须用 PGobject）。</p>
 *
 * <p>{@code objectKey} 只存 S3 内 key，绝不存 URL：endpoint / 签名策略变化时数据仍然有效。</p>
 */
@Data
@TableName(value = "music_track", autoResultMap = true)
public class MusicTrack implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 归属用户（账号绑定，所有读写都以该列为作用域） */
    private Long ownerId;

    private String title;

    private String artist;

    /** 时长（毫秒），由前端读音频 metadata 后提交，后端只做上限校验 */
    private Integer durationMs;

    /** S3 music 桶内对象 key */
    private String objectKey;

    /** 预留：封面对象 key（P1 使用） */
    private String coverKey;

    /** 封面双色渐变，JSON 数组字符串（jsonb 列） */
    @TableField(typeHandler = JsonbTypeHandler.class)
    private String coverColor;

    /** 来源：UPLOAD / AI_GEN / JAMENDO / AIGEI_CC / AI_OTHER */
    private String source;

    /** 许可：CC0 / CC-BY / OWNED / AI_GEN / LICENSED（CC-BY-NC 一律不接受） */
    private String license;

    /** 署名文案（CC-BY 必填） */
    private String attribution;

    private String licenseUrl;

    /** AI 生成标识（显式 + 隐式） */
    private Boolean aiDisclosure;

    /** AI 模型标识，aiDisclosure=true 时必填 */
    private String aiModel;

    /** 标签数组（PostgreSQL text[]） */
    @TableField(typeHandler = StringArrayTypeHandler.class)
    private String[] tags;

    /** 是否进背景音池 */
    private Boolean ambientEnabled;

    /** 背景音池人工排序，越小越靠前 */
    private Integer ambientOrder;

    /** 状态：published / hidden */
    private String status;

    private OffsetDateTime createdAt;

    private OffsetDateTime updatedAt;

    /** 软删除标记（MP 逻辑删除：查询自动过滤，删除改为置 true） */
    @TableLogic(value = "false", delval = "true")
    private Boolean deleted;
}
