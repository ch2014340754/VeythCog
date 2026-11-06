package com.vc.knowledge.splitter;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 自定义递归字符切片器（不依赖 Alibaba splitter）。
 * <p>分隔符优先级：\n\n &gt; \n &gt; 句号(。) &gt; 逗号(，) &gt; 空格；
 * 优先保留 fenced code block 不被切碎；输入源为文档 markdown_text，P0 不基于 Block 块结构切片。</p>
 */
public class RecursiveCharacterTextSplitter {

    private static final List<String> SEPARATORS = List.of("\n\n", "\n", "。", "，", " ");
    private static final Pattern CODE_BLOCK = Pattern.compile("```[\\s\\S]*?```");
    private static final String JOIN = " ";

    private final int chunkSize;
    private final int chunkOverlap;

    public RecursiveCharacterTextSplitter(int chunkSize, int chunkOverlap) {
        this.chunkSize = Math.max(1, chunkSize);
        this.chunkOverlap = Math.max(0, Math.min(chunkOverlap, this.chunkSize - 1));
    }

    public List<String> split(String text) {
        if (text == null || text.isBlank()) {
            return List.of();
        }
        Map<String, String> codeBlocks = new LinkedHashMap<>();
        String protectedText = protectCodeBlocks(text, codeBlocks);
        List<String> pieces = splitRecursive(protectedText, 0);
        List<String> chunks = merge(pieces);
        List<String> result = new ArrayList<>(chunks.size());
        for (String chunk : chunks) {
            result.add(restoreCodeBlocks(chunk, codeBlocks).trim());
        }
        return result;
    }

    private String protectCodeBlocks(String text, Map<String, String> codeBlocks) {
        Matcher m = CODE_BLOCK.matcher(text);
        StringBuffer sb = new StringBuffer();
        int index = 0;
        while (m.find()) {
            String token = "\u0000CODE" + index++ + "\u0000";
            codeBlocks.put(token, m.group());
            m.appendReplacement(sb, Matcher.quoteReplacement(token));
        }
        m.appendTail(sb);
        return sb.toString();
    }

    private String restoreCodeBlocks(String text, Map<String, String> codeBlocks) {
        String result = text;
        for (Map.Entry<String, String> e : codeBlocks.entrySet()) {
            result = result.replace(e.getKey(), e.getValue());
        }
        return result;
    }

    private List<String> splitRecursive(String text, int separatorIndex) {
        if (text.length() <= chunkSize) {
            return text.isBlank() ? List.of() : List.of(text);
        }
        if (separatorIndex >= SEPARATORS.size()) {
            return hardSplit(text);
        }
        String separator = SEPARATORS.get(separatorIndex);
        String[] parts = text.split(Pattern.quote(separator), -1);
        List<String> result = new ArrayList<>();
        for (String part : parts) {
            if (part.length() <= chunkSize) {
                if (!part.isBlank()) {
                    result.add(part);
                }
            } else {
                result.addAll(splitRecursive(part, separatorIndex + 1));
            }
        }
        return result;
    }

    private List<String> hardSplit(String text) {
        List<String> chunks = new ArrayList<>();
        int start = 0;
        while (start < text.length()) {
            int end = Math.min(start + chunkSize, text.length());
            chunks.add(text.substring(start, end));
            if (end >= text.length()) {
                break;
            }
            start = end - chunkOverlap;
        }
        return chunks;
    }

    private List<String> merge(List<String> pieces) {
        List<String> chunks = new ArrayList<>();
        List<String> current = new ArrayList<>();
        int total = 0;
        for (String piece : pieces) {
            int len = piece.length();
            int sepLen = current.isEmpty() ? 0 : JOIN.length();
            if (total + len + sepLen > chunkSize) {
                if (!current.isEmpty()) {
                    String doc = String.join(JOIN, current);
                    if (!doc.isBlank()) {
                        chunks.add(doc);
                    }
                    while (total > chunkOverlap
                            || (total + len + (current.isEmpty() ? 0 : JOIN.length()) > chunkSize && total > 0)) {
                        int firstLen = current.get(0).length();
                        int firstSep = current.size() > 1 ? JOIN.length() : 0;
                        total -= firstLen + firstSep;
                        current.remove(0);
                    }
                }
                current.add(piece);
                total += len + (current.size() > 1 ? JOIN.length() : 0);
            } else {
                current.add(piece);
                total += len + (current.size() > 1 ? JOIN.length() : 0);
            }
        }
        if (!current.isEmpty()) {
            String doc = String.join(JOIN, current);
            if (!doc.isBlank()) {
                chunks.add(doc);
            }
        }
        return chunks;
    }
}
