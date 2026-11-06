package com.vc.knowledge.dto;

import lombok.Data;

import java.io.Serializable;
import java.util.List;

/**
 * 分页返回结构。
 */
@Data
public class PageResult<T> implements Serializable {

    private List<T> records;

    private long total;

    private int current;

    private int pageSize;

    public PageResult(List<T> records, long total, int current, int pageSize) {
        this.records = records;
        this.total = total;
        this.current = current;
        this.pageSize = pageSize;
    }
}
