package com.vc.nav.dto;

import lombok.Data;

/**
 * 更新用户首页配置请求。
 */
@Data
public class SettingUpdateRequest {

    /** 搜索引擎（baidu / google / bing），可空 */
    private String searchEngine;

    /** 上次选中的分类 ID，可空 */
    private Long activeCategoryId;
}
