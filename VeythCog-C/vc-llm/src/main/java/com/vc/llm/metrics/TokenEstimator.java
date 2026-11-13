package com.vc.llm.metrics;

/**
 * 轻量 token 估算：CJK 字符按 1 token，其余按 4 字符 1 token。
 * <p>用于上下文压缩判定与监控口径；不追求与厂商 tokenizer 完全一致。</p>
 */
public final class TokenEstimator {

    private TokenEstimator() {
    }

    public static int estimate(String text) {
        if (text == null || text.isEmpty()) {
            return 0;
        }
        int cjk = 0;
        int other = 0;
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            if ((c >= 0x4E00 && c <= 0x9FFF) || (c >= 0x3040 && c <= 0x30FF) || (c >= 0xAC00 && c <= 0xD7AF)) {
                cjk++;
            } else {
                other++;
            }
        }
        return cjk + Math.max(1, (other + 3) / 4);
    }
}
