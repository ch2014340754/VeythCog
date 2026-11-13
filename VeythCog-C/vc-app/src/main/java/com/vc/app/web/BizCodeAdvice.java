package com.vc.app.web;

import com.vc.common.BaseResponse;
import org.springframework.core.MethodParameter;
import org.springframework.http.MediaType;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyAdvice;

/**
 * 把统一响应体里的业务码写回请求属性，供 ApiAccessLogFilter 采集。
 *
 * <p>为什么必须这么做：本项目所有接口都返回 HTTP 200 + {@code {code,data,message}}，
 * 异常也由 GlobalExceptionHandler 统一包装成 BaseResponse。只看 HTTP status 的话，
 * 错误率永远是 0；真正有意义的错误口径是 {@code code != 0}。</p>
 */
@RestControllerAdvice
public class BizCodeAdvice implements ResponseBodyAdvice<Object> {

    public static final String ATTR_BIZ_CODE = "vc.bizCode";
    public static final String ATTR_BIZ_MESSAGE = "vc.bizMessage";

    @Override
    public boolean supports(MethodParameter returnType, Class converterType) {
        return returnType != null
                && BaseResponse.class.isAssignableFrom(returnType.getParameterType());
    }

    @Override
    public Object beforeBodyWrite(Object body, MethodParameter returnType, MediaType selectedContentType,
                                  Class selectedConverterType, ServerHttpRequest request,
                                  ServerHttpResponse response) {
        if (body instanceof BaseResponse<?> base && request instanceof ServletServerHttpRequest servletRequest) {
            var raw = servletRequest.getServletRequest();
            raw.setAttribute(ATTR_BIZ_CODE, base.getCode());
            if (base.getCode() != 0) {
                raw.setAttribute(ATTR_BIZ_MESSAGE, base.getMessage());
            }
        }
        return body;
    }
}
