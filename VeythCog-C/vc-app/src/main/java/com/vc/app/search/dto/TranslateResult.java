package com.vc.app.search.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

/**
 * 搜索框首行翻译结果。
 */
@Data
@AllArgsConstructor
public class TranslateResult {

    private String sourceLang;

    private String targetLang;

    private String translatedText;

    private boolean cached;
}
