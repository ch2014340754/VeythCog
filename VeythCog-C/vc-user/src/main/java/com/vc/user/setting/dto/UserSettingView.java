package com.vc.user.setting.dto;

import lombok.Data;

import java.io.Serializable;
import java.time.OffsetDateTime;

/**
 * 用户偏好下发视图。
 *
 * <p>字段名与旧 {@code NavSetting} 保持一致（searchEngine / currentWallpaperKey / activeCategoryId），
 * 这样 {@code GET /nav/bootstrap} 的 {@code setting} 结构不变，前端无需改读取逻辑。</p>
 */
@Data
public class UserSettingView implements Serializable {

    private Long userId;

    /** 默认搜索引擎（baidu / google / bing） */
    private String searchEngine;

    /** 锁定的壁纸 S3 key；null = 每次随机 */
    private String currentWallpaperKey;

    /** 上次选中的导航分类 */
    private Long activeCategoryId;

    /** 首页默认视图：today / nav；缺省按 today 下发 */
    private String homeView;

    private OffsetDateTime updatedAt;
}
