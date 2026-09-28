package com.vc.llm.enums;

/**
 * 大模型供应商枚举（固定、代码级常量）。
 *
 * <p>供应商集合是系统级固定常量（新增需同时改 factory 与配置），不适合建表，
 * 故以枚举承载 code/name；模型（llm_model）与用户绑定（user_llm_binding）
 * 中的 vendor_code 仅存 code 字符串，不再外键供应商表。
 */
public enum LlmVendor {

    DASHSCOPE("dashscope", "阿里百炼"),
    DEEPSEEK("deepseek", "DeepSeek");

    private final String code;
    private final String name;

    LlmVendor(String code, String name) {
        this.code = code;
        this.name = name;
    }

    public String getCode() {
        return code;
    }

    public String getName() {
        return name;
    }

    /** 按 code 查找（大小写不敏感）；未知返回 null */
    public static LlmVendor fromCode(String code) {
        if (code == null) {
            return null;
        }
        for (LlmVendor v : values()) {
            if (v.code.equalsIgnoreCase(code)) {
                return v;
            }
        }
        return null;
    }
}
