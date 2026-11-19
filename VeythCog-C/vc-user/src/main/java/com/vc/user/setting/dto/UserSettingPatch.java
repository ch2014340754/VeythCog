package com.vc.user.setting.dto;

import lombok.Data;

import java.io.Serializable;
import java.util.List;

/**
 * 用户偏好更新请求。
 *
 * <p>语义固定：字段为 {@code null} / 省略 = 不修改；要清空某字段必须写进 {@link #clear} 白名单。
 * 这样避免「null 到底是不改还是清空」的歧义（旧 {@code PUT /nav/setting} 是 null=不改）。</p>
 */
@Data
public class UserSettingPatch implements Serializable {

    /** 默认搜索引擎（baidu / google / bing）；null = 不改 */
    private String searchEngine;

    /** 上次选中的导航分类；null = 不改 */
    private Long activeCategoryId;

    /** 首页默认视图：today / nav；null = 不改 */
    private String homeView;

    /** 显式置 NULL 的字段名白名单（当前支持 activeCategoryId、currentWallpaperKey） */
    private List<String> clear;
}
