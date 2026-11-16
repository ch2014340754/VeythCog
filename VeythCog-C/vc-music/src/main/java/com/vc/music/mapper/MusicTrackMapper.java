package com.vc.music.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.vc.music.entity.MusicTrack;
import org.apache.ibatis.annotations.Param;

/**
 * 曲库 Mapper：普通 CRUD 走 BaseMapper；关键词 / tags 数组 / 背景音池过滤（PG 特有语法）收拢到 XML。
 */
public interface MusicTrackMapper extends BaseMapper<MusicTrack> {

    /**
     * 曲库列表分页检索。
     *
     * @param ownerId     当前登录用户（账号隔离作用域，必填）
     * @param keyword     标题 / 艺人关键词，已由服务层做过 LIKE 通配符转义，可为空
     * @param source      来源过滤（UPLOAD / AI_GEN / ...），可为空
     * @param ambientOnly 只看背景音池（ambient_enabled=true 且 status=published）
     * @param tag         标签过滤，可为空
     */
    IPage<MusicTrack> selectTrackPage(Page<MusicTrack> page,
                                      @Param("ownerId") Long ownerId,
                                      @Param("keyword") String keyword,
                                      @Param("source") String source,
                                      @Param("ambientOnly") boolean ambientOnly,
                                      @Param("tag") String tag,
                                      @Param("sortField") String sortField,
                                      @Param("sortOrder") String sortOrder);
}
