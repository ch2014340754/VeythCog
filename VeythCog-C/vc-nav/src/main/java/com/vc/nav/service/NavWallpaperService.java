package com.vc.nav.service;

import com.vc.common.exception.BusinessException;
import com.vc.common.exception.ErrorCode;
import com.vc.common.s3.S3Bucket;
import com.vc.common.s3.S3ClientProvider;
import com.vc.common.s3.S3PresignService;
import com.vc.nav.dto.WallpaperLockRequest;
import com.vc.nav.entity.NavSetting;
import com.vc.nav.mapper.NavSettingMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Request;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Response;
import software.amazon.awssdk.services.s3.model.S3Object;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;

/**
 * 壁纸服务：从 S3 wallpapers 桶随机取一张 / 列出清单 / 锁定。
 * <p>wallpapers 桶为私有桶，所有访问都走预签名 URL（7 天有效期）。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class NavWallpaperService {

    private final S3ClientProvider clientProvider;
    private final S3PresignService presignService;
    private final NavSettingMapper settingMapper;

    /**
     * 壁纸项（key + 预签名 URL）。
     */
    public record WallpaperItem(String key, String url) {}

    /**
     * 列出 wallpapers 桶所有对象（预签名 URL）。
     */
    public List<WallpaperItem> list() {
        List<String> keys = listWallpaperKeys();
        List<WallpaperItem> result = new ArrayList<>(keys.size());
        for (String key : keys) {
            String url = presignService.presignGetUrl(S3Bucket.WALLPAPERS, key);
            result.add(new WallpaperItem(key, url));
        }
        return result;
    }

    /**
     * 随机取一张壁纸（预签名 URL）。
     * 桶为空时返回 null（前端用本地默认壁纸兜底）。
     */
    public WallpaperItem random() {
        List<String> keys = listWallpaperKeys();
        if (keys.isEmpty()) {
            return null;
        }
        String key = keys.get(ThreadLocalRandom.current().nextInt(keys.size()));
        String url = presignService.presignGetUrl(S3Bucket.WALLPAPERS, key);
        return new WallpaperItem(key, url);
    }

    /**
     * 锁定壁纸（写 nav_setting.current_wallpaper_key）。
     * key 传 null 表示解锁随机。
     */
    public void lock(Long userId, WallpaperLockRequest req) {
        NavSetting setting = settingMapper.selectById(userId);
        boolean isNew = (setting == null);
        if (isNew) {
            setting = new NavSetting();
            setting.setUserId(userId);
            setting.setSearchEngine("baidu");
        }
        setting.setCurrentWallpaperKey(req.getKey());
        if (isNew) {
            settingMapper.insert(setting);
        } else {
            settingMapper.updateById(setting);
        }
    }

    /**
     * 列出 wallpapers 桶所有对象 key。
     * S3 配置缺失时静默返回空列表（前端用本地默认壁纸兜底）。
     */
    private List<String> listWallpaperKeys() {
        try {
            S3Client client = clientProvider.getS3Client();
            ListObjectsV2Request request = ListObjectsV2Request.builder()
                    .bucket(S3Bucket.WALLPAPERS.getBucketName())
                    .build();
            ListObjectsV2Response response = client.listObjectsV2(request);
            List<String> keys = new ArrayList<>();
            for (S3Object obj : response.contents()) {
                // 跳过目录占位（以 / 结尾的 key）
                if (!obj.key().endsWith("/")) {
                    keys.add(obj.key());
                }
            }
            return keys;
        } catch (Exception e) {
            log.warn("列出 wallpapers 桶失败，前端将用本地默认壁纸兜底：{}", e.getMessage());
            return List.of();
        }
    }
}
