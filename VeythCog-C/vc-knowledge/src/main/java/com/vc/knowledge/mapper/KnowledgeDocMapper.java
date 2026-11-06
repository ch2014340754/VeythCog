package com.vc.knowledge.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.vc.knowledge.entity.KnowledgeDoc;
import org.apache.ibatis.annotations.Param;

/**
 * 文档 Mapper：普通 CRUD 用 BaseMapper；关键词全文检索 + tags 数组过滤（PG 特有语法）收拢到 XML。
 */
public interface KnowledgeDocMapper extends BaseMapper<KnowledgeDoc> {

    /**
     * 文档列表分页检索：libType 过滤 + 关键词全文检索 + tags 数组过滤 + 排序 + 分页。
     */
    IPage<KnowledgeDoc> selectDocList(Page<KnowledgeDoc> page,
                                      @Param("libType") String libType,
                                      @Param("keyword") String keyword,
                                      @Param("tag") String tag,
                                      @Param("sortField") String sortField,
                                      @Param("sortOrder") String sortOrder);
}
