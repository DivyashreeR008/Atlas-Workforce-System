package com.atlas.common.auth;

import com.fasterxml.jackson.databind.ObjectMapper;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Map;

public class InternalAuthTokenValidator {

    private final String secret;
    private final ObjectMapper objectMapper;

    public InternalAuthTokenValidator(String secret) {
        this.secret = secret;
        this.objectMapper = new ObjectMapper();
    }

    public ValidationResult validate(String authHeader) {
        if (authHeader == null || authHeader.isEmpty()) {
            return ValidationResult.error(401, "Missing internal authentication");
        }

        try {
            String[] parts = authHeader.split("\\.");
            if (parts.length != 3) {
                return ValidationResult.error(401, "Invalid token format");
            }

            String header = parts[0];
            String payload = parts[1];
            String signature = parts[2];

            String expectedSignature = computeHmac(header + "." + payload, secret);
            if (!expectedSignature.equals(signature)) {
                return ValidationResult.error(401, "Invalid token signature");
            }

            String decodedPayload = new String(Base64.getUrlDecoder().decode(payload), StandardCharsets.UTF_8);
            @SuppressWarnings("unchecked")
            Map<String, Object> claims = objectMapper.readValue(decodedPayload, Map.class);

            long exp = claims.containsKey("exp") ? ((Number) claims.get("exp")).longValue() : 0;
            if (System.currentTimeMillis() / 1000 > exp) {
                return ValidationResult.error(401, "Token expired");
            }

            return ValidationResult.success(claims);
        } catch (Exception e) {
            return ValidationResult.error(401, "Invalid internal authentication");
        }
    }

    private String computeHmac(String data, String secret) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        SecretKeySpec keySpec = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
        mac.init(keySpec);
        byte[] hash = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
        return Base64.getUrlEncoder().withoutPadding().encodeToString(hash);
    }

    public static class ValidationResult {
        private final boolean valid;
        private final int status;
        private final String message;
        private final Map<String, Object> claims;

        private ValidationResult(boolean valid, int status, String message, Map<String, Object> claims) {
            this.valid = valid;
            this.status = status;
            this.message = message;
            this.claims = claims;
        }

        public static ValidationResult success(Map<String, Object> claims) {
            return new ValidationResult(true, 200, null, claims);
        }

        public static ValidationResult error(int status, String message) {
            return new ValidationResult(false, status, message, null);
        }

        public boolean isValid() { return valid; }
        public int getStatus() { return status; }
        public String getMessage() { return message; }
        public Map<String, Object> getClaims() { return claims; }
    }
}
