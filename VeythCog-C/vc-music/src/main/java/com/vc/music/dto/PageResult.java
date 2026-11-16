package com.vc.music.dto;

import lombok.Data;

import java.io.Serializable;
import java.util.List;

/**
 * 分页返回结构（与知识库 PageResult 保持同样的字段名，前端可复用同一套列表渲染）。
 */
@Data
public class PageResult<T> implements Serializable {

    private List<T> records;

    private long total;

    private long current;

    private long pageSize;

    public PageResult(List<T> records, long total, long current, long pageSize) {
        this.records = records;
        this.total = total;
        this.current = current;
        this.pageSize = pageSize;
    }
}
