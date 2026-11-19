package com.vc.user.todo.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * 新建待办请求。
 */
@Data
public class TodoCreateRequest {

    @NotBlank(message = "待办标题不能为空")
    @Size(max = 255, message = "待办标题不能超过 255 字")
    private String title;

    /** 备注，可空 */
    private String note;

    /** 0 低 / 1 普通 / 2 高；缺省 1 */
    private Integer priority;

    /** yyyy-MM-dd；缺省 null */
    private String dueDate;

    /** 外部链接，可空 */
    private String linkUrl;

    /** 关联知识库文档 id，可空 */
    private Long linkDocId;

    /** 所属列表 id，可空（null = 未归类）；传入时服务层校验归属 */
    private Long listId;
}
