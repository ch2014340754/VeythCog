package com.vc.knowledge.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.vc.knowledge.entity.KnowledgeDoc;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 文档 Mapper：普通 CRUD 用 BaseMapper；关键词全文检索 + tags 数组过滤（PG 特有语法）收拢到 XML。
 */
public interface KnowledgeDocMapper extends BaseMapper<KnowledgeDoc> {

    /**
     * 文档列表分页检索：关键词全文检索 + tags 数组过滤 + 排序 + 分页。
     */
    IPage<KnowledgeDoc> selectDocList(Page<KnowledgeDoc> page,
                                      @Param("keyword") String keyword,
                                      @Param("tag") String tag,
                                      @Param("sortField") String sortField,
                                      @Param("sortOrder") String sortOrder);

    /**
     * 树查询用的轻量文档列表：只取元信息（不含 block_data / markdown_text），
     * 关键词走与列表页同一条 PG 全文检索表达式（复用 GIN 索引）。
     */
    List<KnowledgeDoc> selectTreeDocs(@Param("keyword") String keyword);

    /**
     * 显式更新文档归属目录（folderId 允许为 null，故不用 updateById 的非空策略）。
     * <p>只改 folder_id，不动 updated_at：移动不算内容修改，不应把文档顶到更新时间倒序最前。</p>
     */
    int updateFolderId(@Param("id") Long id, @Param("folderId") Long folderId);
}
