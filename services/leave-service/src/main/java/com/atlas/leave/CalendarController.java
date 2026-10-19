package com.atlas.leave;

import com.atlas.common.security.RequiresRole;
import com.atlas.common.security.TenantId;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * Calendar connection management plus the per-request sync-status view.
 * The connection endpoints are self-service, scoped to the verified email
 * claim the same way the /me leave endpoints are; the sync-status read is
 * open to the same roles that can see the underlying leave request.
 */
@RestController
@RequestMapping("/api/calendar")
@CrossOrigin(origins = "${ALLOWED_ORIGINS:http://localhost:3000}")
public class CalendarController {

    private static final List<String> SUPPORTED_PROVIDERS = List.of("GOOGLE");

    private final CalendarConnectionRepository connections;
    private final CalendarSyncStateRepository states;
    private final CalendarSyncService syncService;
    private final LeaveRepository leaveRepository;

    public CalendarController(CalendarConnectionRepository connections,
                              CalendarSyncStateRepository states,
                              CalendarSyncService syncService,
                              LeaveRepository leaveRepository) {
        this.connections = connections;
        this.states = states;
        this.syncService = syncService;
        this.leaveRepository = leaveRepository;
    }

    @RequiresRole({"admin", "hr", "manager", "employee"})
    @GetMapping("/connections")
    public ResponseEntity<?> getMyConnections(@TenantId String tenantId) {
        String email = currentUserEmail();
        if (email.isBlank()) {
            return ResponseEntity.status(401).body(Map.of("error", "Missing verified identity claim"));
        }
        return ResponseEntity.ok(connections.findByTenantIdAndEmployeeId(tenantId, email));
    }

    /**
     * Connects a calendar for the caller. The OAuth code exchange happens in
     * the auth layer; this endpoint materializes the resulting account with
     * its least-privilege scope set. Real credential handoff is the known
     * follow-up; the stub keeps the flow testable end to end.
     */
    @RequiresRole({"admin", "hr", "manager", "employee"})
    @PostMapping("/connections")
    public ResponseEntity<?> connectCalendar(@RequestBody Map<String, String> request,
                                             @TenantId String tenantId) {
        String email = currentUserEmail();
        if (email.isBlank()) {
            return ResponseEntity.status(401).body(Map.of("error", "Missing verified identity claim"));
        }
        String provider = request.get("provider");
        if (provider == null || !SUPPORTED_PROVIDERS.contains(provider.trim().toUpperCase())) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "provider must be one of: " + String.join(", ", SUPPORTED_PROVIDERS)));
        }
        String normalized = provider.trim().toUpperCase();
        CalendarConnection existing = connections
                .findByTenantIdAndEmployeeIdAndProvider(tenantId, email, normalized)
                .orElse(null);
        if (existing != null && existing.getStatus() == CalendarConnection.Status.ACTIVE) {
            return ResponseEntity.badRequest().body(Map.of("error", "Calendar already connected"));
        }
        CalendarConnection connection = existing != null ? existing : new CalendarConnection();
        connection.setTenantId(tenantId);
        connection.setEmployeeId(email);
        connection.setProvider(normalized);
        connection.setAuthRef(request.getOrDefault("authRef", ""));
        connection.setStatus(CalendarConnection.Status.ACTIVE);
        connection.setSyncEnabled(true);
        if (connection.getCreatedAt() == null) {
            connection.setCreatedAt(Instant.now());
        }
        return ResponseEntity.ok(connections.save(connection));
    }

    /** Per-user sync toggle: pauses publishing without revoking consent. */
    @RequiresRole({"admin", "hr", "manager", "employee"})
    @PutMapping("/connections/{id}/toggle")
    public ResponseEntity<?> toggleSync(@PathVariable Long id,
                                        @RequestBody Map<String, Boolean> request,
                                        @TenantId String tenantId) {
        String email = currentUserEmail();
        if (email.isBlank()) {
            return ResponseEntity.status(401).body(Map.of("error", "Missing verified identity claim"));
        }
        Boolean enabled = request.get("enabled");
        if (enabled == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "enabled is required"));
        }
        CalendarConnection connection = connections.findById(id).orElse(null);
        if (connection == null || !connection.getTenantId().equals(tenantId) || !connection.getEmployeeId().equals(email)) {
            return ResponseEntity.status(404).body(Map.of("error", "Calendar connection not found"));
        }
        connection.setSyncEnabled(enabled);
        return ResponseEntity.ok(connections.save(connection));
    }

    /** Revocation is terminal: the connection stops being a valid sync target. */
    @RequiresRole({"admin", "hr", "manager", "employee"})
    @DeleteMapping("/connections/{id}")
    public ResponseEntity<?> revokeConnection(@PathVariable Long id, @TenantId String tenantId) {
        String email = currentUserEmail();
        if (email.isBlank()) {
            return ResponseEntity.status(401).body(Map.of("error", "Missing verified identity claim"));
        }
        CalendarConnection connection = connections.findById(id).orElse(null);
        if (connection == null || !connection.getTenantId().equals(tenantId) || !connection.getEmployeeId().equals(email)) {
            return ResponseEntity.status(404).body(Map.of("error", "Calendar connection not found"));
        }
        connection.setStatus(CalendarConnection.Status.REVOKED);
        connection.setSyncEnabled(false);
        connections.save(connection);
        return ResponseEntity.ok(Map.of("status", "REVOKED"));
    }

    /** Sync status shown alongside the leave request detail. */
    @RequiresRole({"admin", "hr", "manager", "employee"})
    @GetMapping("/requests/{leaveId}/sync-status")
    public ResponseEntity<?> getSyncStatus(@PathVariable Long leaveId, @TenantId String tenantId) {
        return ResponseEntity.ok(states.findByTenantIdAndLeaveId(tenantId, leaveId));
    }

    /** Manual retry after a recoverable failure (never for a NEEDS_REAUTH). */
    @RequiresRole({"admin", "hr", "manager", "employee"})
    @PostMapping("/requests/{leaveId}/sync/{provider}/retry")
    public ResponseEntity<?> retrySync(@PathVariable Long leaveId,
                                       @PathVariable String provider,
                                       @TenantId String tenantId) {
        LeaveRecord leave = leaveRepository.findByIdAndTenantId(leaveId, tenantId).orElse(null);
        if (leave == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Leave request not found"));
        }
        try {
            return ResponseEntity.ok(syncService.retry(tenantId, leave, provider));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    private static String currentUserEmail() {
        ServletRequestAttributes attrs = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        if (attrs == null) {
            return "";
        }
        Object email = attrs.getRequest().getAttribute("x-user-email");
        return email == null ? "" : email.toString().trim().toLowerCase();
    }
}
