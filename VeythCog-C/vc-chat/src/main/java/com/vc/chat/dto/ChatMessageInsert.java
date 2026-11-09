package com.vc.chat.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 记忆批量写入行（seq 由 SQL 的 foreach 下标生成，与写入顺序一致）。
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ChatMessageInsert {

    private String role;

    private String content;
}
