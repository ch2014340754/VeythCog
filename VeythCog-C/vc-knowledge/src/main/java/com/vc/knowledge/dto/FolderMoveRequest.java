package com.vc.knowledge.dto;

import lombok.Data;

import java.io.Serializable;

/**
 * 目录移动请求：parentId 为空表示移到根级。
 */
@Data
public class FolderMoveRequest implements Serializable {

    private Long parentId;
}
