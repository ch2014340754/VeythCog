package com.vc.knowledge.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.vc.knowledge.entity.KnowledgeFolder;
import org.apache.ibatis.annotations.Param;

import java.util.Collection;
import java.util.List;

/**
 * 目录 Mapper：普通 CRUD 用 BaseMapper（@TableLogic 自动过滤软删除）；
 * 递归后代查询与批量软删除收拢到 XML（PG 特有语法）。
 */
public interface KnowledgeFolderMapper extends BaseMapper<KnowledgeFolder> {

    /**
     * 递归取某目录的全部后代 id（**包含自身**），用于移动环检测与递归删除。
     */
    List<Long> selectDescendantIds(@Param("folderId") Long folderId);

    /**
     * 取这些目录下的全部未删文档 id（用于级联删除前清理向量）。
     */
    List<Long> selectDocIdsByFolderIds(@Param("ids") Collection<Long> ids);

    /**
     * 统计这些目录下的未删文档数。
     */
    long countDocsByFolderIds(@Param("ids") Collection<Long> ids);

    /**
     * 批量软删这些目录下的文档（显式写 deleted = true）。
     */
    int softDeleteDocsByFolderIds(@Param("ids") Collection<Long> ids);

    /**
     * 批量软删目录（显式写 deleted = true）。
     */
    int softDeleteFolders(@Param("ids") Collection<Long> ids);

    /**
     * 显式更新父目录（parentId 允许为 null，故不能用 updateById 的非空策略）。
     */
    int updateParent(@Param("id") Long id, @Param("parentId") Long parentId);
}
