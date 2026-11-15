package com.vc.user.setting;

import com.vc.common.exception.BusinessException;
import com.vc.common.exception.ErrorCode;
import com.vc.user.setting.dto.UserSettingPatch;
import com.vc.user.setting.dto.UserSettingView;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * 用户偏好统一读写入口（user_setting）。
 *
 * <p>所有「按用户保存的偏好」都走这里：业务域只调 {@link #get}/{@link #patch}，
 * 不自己写 SQL、不自己建表。新增偏好时在此加一个字段与 patch 分支即可。</p>
 */
@Service
@RequiredArgsConstructor
public class UserSettingService {

    /** 支持的搜索引擎（与前端 SearchBar 一致） */
    private static final Set<String> SEARCH_ENGINES = Set.of("baidu", "google", "bing");

    /** 允许被 clear 显式置空的字段白名单（新增可空字段时记得加进来） */
    private static final Set<String> CLEARABLE_FIELDS = Set.of("activeCategoryId", "currentWallpaperKey");

    private final UserSettingMapper settingMapper;

    /**
     * 读取当前用户偏好；行不存在时返回默认视图（不落库）。
     */
    public UserSettingView get(Long userId) {
        UserSetting setting = settingMapper.selectById(userId);
        if (setting == null) {
            setting = newDefault(userId);
        }
        return toView(setting);
    }

    /**
     * 局部更新（upsert）：null 字段不改，{@code clear} 中的字段置 NULL。
     */
    @Transactional
    public UserSettingView patch(Long userId, UserSettingPatch req) {
        Set<String> clear = normalizeClear(req == null ? null : req.getClear());
        UserSetting setting = settingMapper.selectById(userId);
        boolean isNew = setting == null;
        if (isNew) {
            setting = newDefault(userId);
        }

        String engine = req == null ? null : req.getSearchEngine();
        if (engine != null) {
            String normalized = engine.trim().toLowerCase(Locale.ROOT);
            if (!SEARCH_ENGINES.contains(normalized)) {
                throw new BusinessException(ErrorCode.PARAMS_ERROR, "不支持的搜索引擎：" + engine);
            }
            setting.setSearchEngine(normalized);
        }
        if (req != null && req.getActiveCategoryId() != null) {
            setting.setActiveCategoryId(req.getActiveCategoryId());
        }
        if (clear.contains("activeCategoryId")) {
            setting.setActiveCategoryId(null);
        }
        if (clear.contains("currentWallpaperKey")) {
            setting.setCurrentWallpaperKey(null);
        }

        save(setting, isNew);
        return toView(setting);
    }

    /**
     * 写入锁定壁纸；key 为 null 表示解锁（下次进首页随机）。
     */
    @Transactional
    public void updateWallpaperKey(Long userId, String key) {
        UserSetting setting = settingMapper.selectById(userId);
        boolean isNew = setting == null;
        if (isNew) {
            setting = newDefault(userId);
        }
        setting.setCurrentWallpaperKey(key);
        save(setting, isNew);
    }

    /**
     * 当前用户锁定的壁纸 key；没有记录/未设置返回 null。
     */
    public String currentWallpaperKey(Long userId) {
        UserSetting setting = settingMapper.selectById(userId);
        return setting == null ? null : setting.getCurrentWallpaperKey();
    }

    private void save(UserSetting setting, boolean isNew) {
        setting.setUpdatedAt(OffsetDateTime.now());
        if (isNew) {
            settingMapper.insert(setting);
        } else {
            settingMapper.updateById(setting);
        }
    }

    private UserSetting newDefault(Long userId) {
        UserSetting setting = new UserSetting();
        setting.setUserId(userId);
        setting.setSearchEngine("baidu");
        return setting;
    }

    private Set<String> normalizeClear(List<String> clear) {
        if (clear == null || clear.isEmpty()) {
            return Set.of();
        }
        Set<String> normalized = new LinkedHashSet<>();
        for (String field : clear) {
            if (field == null || field.isBlank()) {
                continue;
            }
            String name = field.trim();
            if (!CLEARABLE_FIELDS.contains(name)) {
                throw new BusinessException(ErrorCode.PARAMS_ERROR, "不支持清空的字段：" + name);
            }
            normalized.add(name);
        }
        return normalized;
    }

    private UserSettingView toView(UserSetting setting) {
        UserSettingView view = new UserSettingView();
        view.setUserId(setting.getUserId());
        view.setSearchEngine(setting.getSearchEngine());
        view.setCurrentWallpaperKey(setting.getCurrentWallpaperKey());
        view.setActiveCategoryId(setting.getActiveCategoryId());
        view.setUpdatedAt(setting.getUpdatedAt());
        return view;
    }
}
