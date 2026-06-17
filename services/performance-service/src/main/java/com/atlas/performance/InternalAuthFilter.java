package com.atlas.performance;

import com.atlas.common.auth.InternalAuthTokenValidator;
import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.Map;

@Component
@Order(1)
public class InternalAuthFilter implements Filter {

    private final InternalAuthTokenValidator validator;

    public InternalAuthFilter(@Value("${INTERNAL_JWT_SECRET:}") String internalJwtSecret) {
        this.validator = new InternalAuthTokenValidator(internalJwtSecret);
    }

    @Override
    public void doFilter(ServletRequest servletRequest, ServletResponse servletResponse, FilterChain filterChain)
            throws IOException, ServletException {

        HttpServletRequest request = (HttpServletRequest) servletRequest;
        HttpServletResponse response = (HttpServletResponse) servletResponse;

        String path = request.getRequestURI();
        if ("/health".equals(path)) {
            filterChain.doFilter(request, response);
            return;
        }

        String authHeader = request.getHeader("x-internal-auth");
        InternalAuthTokenValidator.ValidationResult result = validator.validate(authHeader);

        if (!result.isValid()) {
            sendError(response, result.getStatus(), result.getMessage());
            return;
        }

        Map<String, Object> claims = result.getClaims();
        request.setAttribute("x-tenant-id", claims.getOrDefault("tenant_id", "default"));
        request.setAttribute("x-user-role", claims.getOrDefault("user_role", "employee"));
        request.setAttribute("x-user-id", claims.getOrDefault("user_id", ""));

        filterChain.doFilter(request, response);
    }

    private void sendError(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        response.getWriter().write("{\"error\":\"" + message + "\"}");
    }
}
