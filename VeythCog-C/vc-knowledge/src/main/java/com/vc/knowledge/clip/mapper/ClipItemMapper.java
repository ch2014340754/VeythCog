package com.vc.knowledge.clip.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.vc.knowledge.clip.entity.ClipItem;

/**
 * 收件箱条目 Mapper：查询全部走 QueryWrapper（账号 + 状态 + 关键词），无需 XML。
 */
public interface ClipItemMapper extends BaseMapper<ClipItem> {
}
