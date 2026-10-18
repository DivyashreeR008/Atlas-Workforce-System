package com.ems.payroll.controller;

import com.atlas.common.security.RequiresRole;
import com.atlas.common.security.TenantId;
import com.ems.payroll.model.Payslip;
import com.ems.payroll.service.PayrollEnterpriseService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Optional;

/**
 * Self-service payslip endpoints for the employee portal.
 *
 * Every lookup is scoped by the verified email claim minted by the gateway
 * (x-user-email attribute, set by InternalAuthFilter) plus the verified
 * tenant. Nothing about the identity is read from the request, so a payslip
 * id belonging to somebody else resolves to 404 - not to their data.
 */
@RestController
@RequestMapping("/api/payroll/me")
@CrossOrigin(origins = "${ALLOWED_ORIGINS:http://localhost:3000}")
public class PayrollSelfController {

    private final PayrollEnterpriseService service;

    public PayrollSelfController(PayrollEnterpriseService service) {
        this.service = service;
    }

    @RequiresRole({"admin", "hr", "manager", "employee"})
    @GetMapping("/payslips")
    public ResponseEntity<?> getMyPayslips(HttpServletRequest request, @TenantId String tenantId) {
        String email = selfEmail(request);
        if (email.isBlank()) {
            return ResponseEntity.status(401).body(Map.of("message", "Missing verified identity claim"));
        }
        return ResponseEntity.ok(service.getEmployeePayslips(tenantId, email));
    }

    @RequiresRole({"admin", "hr", "manager", "employee"})
    @GetMapping("/payslips/{payslipId}")
    public ResponseEntity<?> getMyPayslip(
            HttpServletRequest request,
            @TenantId String tenantId,
            @PathVariable Long payslipId) {
        String email = selfEmail(request);
        if (email.isBlank()) {
            return ResponseEntity.status(401).body(Map.of("message", "Missing verified identity claim"));
        }
        Optional<Payslip> payslip = service.getEmployeePayslip(tenantId, email, payslipId);
        if (payslip.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("message", "Payslip not found"));
        }
        return ResponseEntity.ok(payslip.get());
    }

    /**
     * Download the payslip document generated at payroll time. The stored
     * document is the plain-text payslip rendered by the payroll run; the
     * portal's print view is what turns it into a PDF in the browser.
     */
    @RequiresRole({"admin", "hr", "manager", "employee"})
    @GetMapping("/payslips/{payslipId}/download")
    public ResponseEntity<?> downloadMyPayslip(
            HttpServletRequest request,
            @TenantId String tenantId,
            @PathVariable Long payslipId) {
        String email = selfEmail(request);
        if (email.isBlank()) {
            return ResponseEntity.status(401).body(Map.of("message", "Missing verified identity claim"));
        }
        Optional<Payslip> payslip = service.getEmployeePayslip(tenantId, email, payslipId);
        if (payslip.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of("message", "Payslip not found"));
        }

        Payslip found = payslip.get();
        String content = found.getPdfContent() == null ? "" : found.getPdfContent();
        String period = found.getPeriod() == null ? String.valueOf(found.getId()) : found.getPeriod();
        return ResponseEntity.ok()
                .contentType(MediaType.TEXT_PLAIN)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"payslip-" + period + ".txt\"")
                .body(content.getBytes(StandardCharsets.UTF_8));
    }

    private static String selfEmail(HttpServletRequest request) {
        Object email = request.getAttribute("x-user-email");
        return email == null ? "" : email.toString().trim().toLowerCase();
    }
}
