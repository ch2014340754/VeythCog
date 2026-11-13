package com.vc.llm.model;

import org.springframework.util.StringUtils;

import java.util.Collection;
import java.util.EnumSet;
import java.util.List;
import java.util.Locale;

/**
 * 模型类型：用于目录/选择页图标展示，并决定连通校验的探测方式。
 *
 * <p>取值与百炼 {@code capabilities} 对齐：TG / Reasoning / VU / IG / VG / ASR / TTS / ME /
 * Realtime-Omni / Multimodal-Omni。DeepSeek 等 OpenAI 兼容供应商没有能力字段，按模型编码推断。</p>
 */
public enum ModelType {

    TEXT("text", "文本", true, true),
    REASONING("reasoning", "推理", true, true),
    VISION("vision", "多模态理解", true, true),
    OMNI("omni", "全模态", true, true),
    IMAGE("image", "图像生成", false, true),
    VIDEO("video", "视频生成", false, true),
    AUDIO("audio", "语音", false, true),
    EMBEDDING("embedding", "向量", false, true),
    OTHER("other", "其他", false, false);

    private final String code;
    private final String label;
    private final boolean chatCapable;
    private final boolean verifySupported;

    ModelType(String code, String label, boolean chatCapable, boolean verifySupported) {
        this.code = code;
        this.label = label;
        this.chatCapable = chatCapable;
        this.verifySupported = verifySupported;
    }

    public String getCode() {
        return code;
    }

    public String getLabel() {
        return label;
    }

    /** 能否作为对话模型使用（图像/视频/语音/向量模型不能进对话下拉） */
    public boolean isChatCapable() {
        return chatCapable;
    }

    /** 是否有可执行的连通校验方式 */
    public boolean isVerifySupported() {
        return verifySupported;
    }

    public static ModelType fromCode(String code) {
        if (!StringUtils.hasText(code)) {
            return TEXT;
        }
        String normalized = code.trim().toLowerCase(Locale.ROOT);
        for (ModelType type : values()) {
            if (type.code.equals(normalized)) {
                return type;
            }
        }
        return OTHER;
    }

    /** 校验/写库用：非法取值抛 IllegalArgumentException，由调用方转业务错误 */
    public static ModelType requireCode(String code) {
        ModelType type = fromCode(code);
        if (type == OTHER && StringUtils.hasText(code) && !"other".equalsIgnoreCase(code.trim())) {
            throw new IllegalArgumentException("不支持的模型类型：" + code);
        }
        return type;
    }

    /** 百炼 capabilities → 主类型；TG 与 VU 并存时优先文本生成能力，避免把可对话模型判成纯视觉 */
    public static ModelType fromCapabilities(Collection<String> capabilities) {
        return primaryFrom(ModelType.allFromCapabilities(capabilities));
    }

    /** 百炼 capabilities → 全部模态（text/reasoning/vision/image/video/audio/embedding/omni） */
    public static List<ModelType> allFromCapabilities(Collection<String> capabilities) {
        EnumSet<ModelType> types = EnumSet.noneOf(ModelType.class);
        if (capabilities == null || capabilities.isEmpty()) {
            return List.of(OTHER);
        }
        for (String raw : capabilities) {
            if (raw == null) {
                continue;
            }
            String cap = raw.trim().toLowerCase(Locale.ROOT);
            switch (cap) {
                case "multimodal-omni", "realtime-omni" -> types.add(OMNI);
                case "vu" -> types.add(VISION);
                case "ig" -> types.add(IMAGE);
                case "vg" -> types.add(VIDEO);
                case "asr", "tts" -> types.add(AUDIO);
                case "me" -> types.add(EMBEDDING);
                case "reasoning" -> types.add(REASONING);
                case "tg" -> types.add(TEXT);
                default -> {
                    // 忽略未知能力
                }
            }
        }
        return types.isEmpty() ? List.of(OTHER) : List.copyOf(types);
    }

    /** 多模态集合 → 主类型：能文本对话的优先，其次按更具体的生成/理解能力 */
    public static ModelType primaryFrom(Collection<ModelType> types) {
        if (types == null || types.isEmpty()) {
            return OTHER;
        }
        if (types.contains(OMNI)) {
            return OMNI;
        }
        if (types.contains(REASONING)) {
            return REASONING;
        }
        if (types.contains(TEXT)) {
            return TEXT;
        }
        if (types.contains(VISION)) {
            return VISION;
        }
        if (types.contains(IMAGE)) {
            return IMAGE;
        }
        if (types.contains(VIDEO)) {
            return VIDEO;
        }
        if (types.contains(AUDIO)) {
            return AUDIO;
        }
        if (types.contains(EMBEDDING)) {
            return EMBEDDING;
        }
        return OTHER;
    }

    /** OpenAI 兼容供应商（无能力字段）按编码推断类型 */
    public static ModelType inferFromCode(String modelCode) {
        if (!StringUtils.hasText(modelCode)) {
            return OTHER;
        }
        String code = modelCode.toLowerCase(Locale.ROOT);
        if (code.contains("embedding") || code.contains("-embed")) {
            return EMBEDDING;
        }
        if (code.contains("tts") || code.contains("speech") || code.contains("audio")
                || code.contains("whisper") || code.contains("asr")) {
            return AUDIO;
        }
        if (code.contains("video") || code.contains("veo") || code.contains("sora")) {
            return VIDEO;
        }
        if (code.contains("image") || code.contains("dall-e") || code.contains("flux")
                || code.contains("stable-diffusion")) {
            return IMAGE;
        }
        if (code.contains("vl") || code.contains("vision") || code.contains("multimodal")) {
            return VISION;
        }
        return TEXT;
    }
}
