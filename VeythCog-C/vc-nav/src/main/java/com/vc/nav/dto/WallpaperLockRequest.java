package com.vc.nav.dto;

import lombok.Data;

/**
 * 锁定壁纸请求。
 */
@Data
public class WallpaperLockRequest {

    /** 壁纸 S3 key；传 null 表示解锁随机 */
    private String key;
}
