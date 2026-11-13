package com.vc.llm.model;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;

/**
 * 模型全部模态的存储编解码（llm_model.modalities，逗号分隔的 ModelType code）。
 */
public final class ModelModalities {

    private ModelModalities() {
    }

    /** 存库：保持顺序、去重；空集合回退 other */
    public static String encode(Collection<ModelType> types) {
        if (types == null || types.isEmpty()) {
            return ModelType.OTHER.getCode();
        }
        LinkedHashSet<String> codes = new LinkedHashSet<>();
        for (ModelType type : types) {
            if (type != null) {
                codes.add(type.getCode());
            }
        }
        return codes.isEmpty() ? ModelType.OTHER.getCode() : String.join(",", codes);
    }

    /** 下发：解析存量逗号串，空值回退主类型，过滤非法项 */
    public static List<String> decode(String stored, String fallbackType) {
        LinkedHashSet<String> codes = new LinkedHashSet<>();
        if (stored != null) {
            for (String raw : stored.split(",")) {
                String code = raw == null ? "" : raw.trim().toLowerCase(Locale.ROOT);
                if (!code.isEmpty()) {
                    codes.add(normalizeCode(code));
                }
            }
        }
        if (codes.isEmpty()) {
            codes.add(normalizeCode(fallbackType));
        }
        return List.copyOf(codes);
    }

    /** 表单输入：允许空，自动补主类型，保证模态里一定包含主类型 */
    public static List<String> normalize(Collection<String> codes, String primaryType) {
        LinkedHashSet<String> result = new LinkedHashSet<>();
        if (codes != null) {
            for (String raw : codes) {
                if (raw != null && !raw.trim().isEmpty()) {
                    result.add(normalizeCode(raw));
                }
            }
        }
        result.add(normalizeCode(primaryType));
        return List.copyOf(result);
    }

    private static String normalizeCode(String code) {
        return ModelType.fromCode(code).getCode();
    }
}
