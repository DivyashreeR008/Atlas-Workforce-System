package com.atlas.common.security;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.core.MethodParameter;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;
import org.springframework.web.server.ResponseStatusException;

public class TenantIdArgumentResolver implements HandlerMethodArgumentResolver {

	public static final String TENANT_ID_ATTRIBUTE = "x-tenant-id";

	@Override
	public boolean supportsParameter(MethodParameter parameter) {
		return parameter.hasParameterAnnotation(TenantId.class)
			&& String.class.isAssignableFrom(parameter.getParameterType());
	}

	@Override
	public Object resolveArgument(MethodParameter parameter, ModelAndViewContainer mavContainer,
			NativeWebRequest webRequest, WebDataBinderFactory binderFactory) {
		HttpServletRequest request = webRequest.getNativeRequest(HttpServletRequest.class);
		if (request != null) {
			Object tenantId = request.getAttribute(TENANT_ID_ATTRIBUTE);
			if (tenantId != null && !tenantId.toString().isBlank()) {
				return tenantId.toString();
			}
		}
		throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing tenant context");
	}
}
