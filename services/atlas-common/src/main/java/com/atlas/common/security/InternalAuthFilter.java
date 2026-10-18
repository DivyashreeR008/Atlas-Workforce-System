package com.atlas.common.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.Map;

@Component
@Order(1)
public class InternalAuthFilter implements Filter {

	private final String internalJwtSecret;
	private final ObjectMapper objectMapper = new ObjectMapper();

	public InternalAuthFilter(@Value("${INTERNAL_JWT_SECRET:}") String internalJwtSecret) {
		this.internalJwtSecret = internalJwtSecret;
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

		if (internalJwtSecret == null || internalJwtSecret.isEmpty()) {
			sendError(response, 500, "Service not configured: INTERNAL_JWT_SECRET missing");
			return;
		}

		String authHeader = request.getHeader("x-internal-auth");
		if (authHeader == null || authHeader.isEmpty()) {
			sendError(response, 401, "Missing internal authentication");
			return;
		}

		try {
			String[] parts = authHeader.split("\\.");
			if (parts.length != 3) {
				sendError(response, 401, "Invalid token format");
				return;
			}

			String header = parts[0];
			String payload = parts[1];
			String signature = parts[2];

			String expectedSignature = computeHmac(header + "." + payload, internalJwtSecret);
			if (!MessageDigest.isEqual(expectedSignature.getBytes(StandardCharsets.UTF_8),
					signature.getBytes(StandardCharsets.UTF_8))) {
				sendError(response, 401, "Invalid token signature");
				return;
			}

			String decodedPayload = new String(Base64.getUrlDecoder().decode(payload), StandardCharsets.UTF_8);
			@SuppressWarnings("unchecked")
			Map<String, Object> claims = objectMapper.readValue(decodedPayload, Map.class);

			Object expClaim = claims.get("exp");
			if (!(expClaim instanceof Number)) {
				sendError(response, 401, "Invalid or missing exp claim");
				return;
			}
			long exp = ((Number) expClaim).longValue();
			if (System.currentTimeMillis() / 1000 > exp) {
				sendError(response, 401, "Token expired");
				return;
			}

			Object tenantClaim = claims.get("tenant_id");
			if (tenantClaim == null || tenantClaim.toString().isBlank()) {
				sendError(response, 401, "Missing tenant claim");
				return;
			}
			String tenantId = tenantClaim.toString();
			String headerTenantId = request.getHeader("X-Tenant-Id");
			if (headerTenantId != null && !headerTenantId.isEmpty() && !tenantId.equals(headerTenantId)) {
				sendError(response, 403, "Tenant mismatch: X-Tenant-Id does not match verified token claims");
				return;
			}

			request.setAttribute("x-tenant-id", tenantId);
			request.setAttribute("x-user-role", claims.getOrDefault("user_role", "employee"));
			request.setAttribute("x-user-id", claims.getOrDefault("user_id", ""));
			// Verified caller email, used by self-service endpoints only. The
			// gateway mints it from the authenticated session; it is empty for
			// service-to-service tokens, and self-service endpoints must then
			// fail closed rather than trusting a request-supplied value.
			Object emailClaim = claims.get("email");
			request.setAttribute("x-user-email", emailClaim == null ? "" : emailClaim.toString());

			filterChain.doFilter(request, response);
		} catch (Exception e) {
			sendError(response, 401, "Invalid internal authentication");
		}
	}

	private String computeHmac(String data, String secret) throws Exception {
		Mac mac = Mac.getInstance("HmacSHA256");
		SecretKeySpec keySpec = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
		mac.init(keySpec);
		byte[] hash = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
		return Base64.getUrlEncoder().withoutPadding().encodeToString(hash);
	}

	private void sendError(HttpServletResponse response, int status, String message) throws IOException {
		response.setStatus(status);
		response.setContentType("application/json");
		response.getWriter().write(objectMapper.writeValueAsString(Map.of("error", message)));
	}
}
