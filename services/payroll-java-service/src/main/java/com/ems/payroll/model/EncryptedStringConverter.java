package com.ems.payroll.model;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.Base64;

@Converter
public class EncryptedStringConverter implements AttributeConverter<String, String> {

    // AES-GCM with a random 12-byte IV per value. The IV is prepended to the
    // ciphertext (iv || ciphertext+tag) and the whole payload is prefixed
    // with "v1:" so legacy AES/ECB rows remain readable (see fallback below).
    // ECB reveals plaintext patterns and must not be used for new writes.
    private static final String GCM_ALGORITHM = "AES/GCM/NoPadding";
    private static final int GCM_IV_BYTES = 12;
    private static final int GCM_TAG_BITS = 128;
    private static final String PREFIX = "v1:";

    // Legacy algorithm kept for read-only decryption of rows written before
    // the GCM migration. Never used for encryption.
    private static final String LEGACY_ALGORITHM = "AES/ECB/PKCS5Padding";

    private static final String ENV_KEY = "BANK_ENCRYPTION_KEY";

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private static SecretKeySpec keySpec;

    private SecretKeySpec getKey() {
        if (keySpec == null) {
            String raw = System.getenv(ENV_KEY);
            if (raw == null || raw.isEmpty()) {
                throw new IllegalStateException("BANK_ENCRYPTION_KEY environment variable is not set");
            }
            byte[] keyBytes;
            if (raw.length() == 32) {
                keyBytes = raw.getBytes(StandardCharsets.UTF_8);
            } else {
                try {
                    MessageDigest sha = MessageDigest.getInstance("SHA-256");
                    keyBytes = Arrays.copyOf(sha.digest(raw.getBytes(StandardCharsets.UTF_8)), 32);
                } catch (java.security.NoSuchAlgorithmException e) {
                    throw new RuntimeException("SHA-256 not available", e);
                }
            }
            keySpec = new SecretKeySpec(keyBytes, "AES");
        }
        return keySpec;
    }

    @Override
    public String convertToDatabaseColumn(String attribute) {
        if (attribute == null) return null;
        try {
            byte[] iv = new byte[GCM_IV_BYTES];
            SECURE_RANDOM.nextBytes(iv);
            Cipher cipher = Cipher.getInstance(GCM_ALGORITHM);
            cipher.init(Cipher.ENCRYPT_MODE, getKey(), new GCMParameterSpec(GCM_TAG_BITS, iv));
            byte[] encrypted = cipher.doFinal(attribute.getBytes(StandardCharsets.UTF_8));
            byte[] payload = new byte[iv.length + encrypted.length];
            System.arraycopy(iv, 0, payload, 0, iv.length);
            System.arraycopy(encrypted, 0, payload, iv.length, encrypted.length);
            return PREFIX + Base64.getEncoder().encodeToString(payload);
        } catch (Exception e) {
            throw new RuntimeException("Encryption failed", e);
        }
    }

    @Override
    public String convertToEntityAttribute(String dbData) {
        if (dbData == null) return null;
        try {
            if (dbData.startsWith(PREFIX)) {
                byte[] payload = Base64.getDecoder().decode(dbData.substring(PREFIX.length()));
                if (payload.length < GCM_IV_BYTES + 1) {
                    throw new RuntimeException("Malformed encrypted payload");
                }
                byte[] iv = Arrays.copyOfRange(payload, 0, GCM_IV_BYTES);
                byte[] ciphertext = Arrays.copyOfRange(payload, GCM_IV_BYTES, payload.length);
                Cipher cipher = Cipher.getInstance(GCM_ALGORITHM);
                cipher.init(Cipher.DECRYPT_MODE, getKey(), new GCMParameterSpec(GCM_TAG_BITS, iv));
                return new String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8);
            }
            return decryptLegacy(dbData);
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new RuntimeException("Decryption failed", e);
        }
    }

    private String decryptLegacy(String dbData) {
        try {
            // Read-only back-compat for rows encrypted before the GCM
            // migration. This path never encrypts; all new writes use
            // AES-GCM (see convertToDatabaseColumn). Removing it would make
            // pre-migration rows unreadable.
            // codeql[java/weak-cryptographic-algorithm]
            Cipher cipher = Cipher.getInstance(LEGACY_ALGORITHM);
            cipher.init(Cipher.DECRYPT_MODE, getKey());
            byte[] decrypted = cipher.doFinal(Base64.getDecoder().decode(dbData));
            return new String(decrypted, StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new RuntimeException("Decryption failed", e);
        }
    }
}
