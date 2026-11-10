package com.vc.nav.service;

import com.vc.nav.dto.SettingUpdateRequest;
import com.vc.nav.entity.NavSetting;
import com.vc.nav.mapper.NavSettingMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * 用户首页配置服务。
 */
@Service
@RequiredArgsConstructor
public class NavSettingService {

    private final NavSettingMapper settingMapper;

    /**
     * 读取当前用户配置；不存在返回默认值（不入库）。
     */
    public NavSetting get(Long userId) {
        NavSetting setting = settingMapper.selectById(userId);
        if (setting == null) {
            setting = new NavSetting();
            setting.setUserId(userId);
            setting.setSearchEngine("baidu");
        }
        return setting;
    }

    /**
     * 更新用户配置（upsert）。
     */
    public void update(Long userId, SettingUpdateRequest req) {
        NavSetting setting = settingMapper.selectById(userId);
        boolean isNew = (setting == null);
        if (isNew) {
            setting = new NavSetting();
            setting.setUserId(userId);
            setting.setSearchEngine("baidu");
        }
        if (req.getSearchEngine() != null && !req.getSearchEngine().isBlank()) {
            setting.setSearchEngine(req.getSearchEngine());
        }
        if (req.getActiveCategoryId() != null) {
            setting.setActiveCategoryId(req.getActiveCategoryId());
        }
        if (isNew) {
            settingMapper.insert(setting);
        } else {
            settingMapper.updateById(setting);
        }
    }
}
