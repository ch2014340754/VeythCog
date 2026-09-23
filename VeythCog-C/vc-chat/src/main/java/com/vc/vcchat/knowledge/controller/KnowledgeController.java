package com.vc.vcchat.knowledge.controller;

import com.vc.vcchat.knowledge.entity.KnowledgeBase;
import com.vc.vcchat.knowledge.service.KnowledgeService;
import com.vc.vccode.common.BaseResponse;
import com.vc.vccode.common.ResultUtils;
import jakarta.annotation.Resource;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 知识库接口骨架
 */
@RestController
@RequestMapping("/knowledge")
public class KnowledgeController {

    @Resource
    private KnowledgeService knowledgeService;

    @GetMapping
    public BaseResponse<List<KnowledgeBase>> list() {
        return ResultUtils.success(knowledgeService.listKnowledgeBases());
    }

    @PostMapping
    public BaseResponse<Long> create(@RequestBody Map<String, String> body) {
        return ResultUtils.success(
                knowledgeService.createKnowledgeBase(body.get("name"), body.get("description")));
    }
}
