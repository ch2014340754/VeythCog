package com.vc.knowledge.dto;

import lombok.Data;

import java.io.Serializable;

/**
 * 文档移动请求：folderId 为空表示移到根级。
 */
@Data
public class DocMoveRequest implements Serializable {

    private Long folderId;
}
