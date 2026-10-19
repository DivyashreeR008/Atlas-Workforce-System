package com.atlas.leave;

import jakarta.persistence.*;
import java.time.Instant;

/**
 * One connected calendar account per (tenant, employee, provider). One-way
 * atlas -> calendar for now; the OAuth code exchange happens outside this
 * service and hands us a stable auth reference plus the least-privilege
 * scopes it was granted (calendar.events for a single calendar).
 */
@Entity
@Table(name = "calendar_connections", indexes = {
    @Index(name = "idx_calendar_conn_employee", columnList = "employeeId")
})
public class CalendarConnection {

    public enum Status { ACTIVE, NEEDS_REAUTH, REVOKED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Version
    @Column(nullable = false)
    private Long version;

    @Column(name = "tenant_id", nullable = false)
    private String tenantId;

    @Column(nullable = false)
    private String employeeId;

    @Column(nullable = false)
    private String provider; // GOOGLE (stubbed), OUTLOOK is a follow-up

    /**
     * Opaque credential/token reference materialized by the stub provider.
     * A blank reference means the stored credential expired or was never
     * completed; the stub provider treats that as a 401.
     */
    private String authRef;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private Status status;

    /** Per-user sync toggle; off pauses publishing without revoking consent. */
    @Column(nullable = false)
    private boolean syncEnabled = true;

    private Instant lastSyncedAt;

    @Column(nullable = false)
    private Instant createdAt;

    public CalendarConnection() {}

    public boolean isPublishable() {
        return status == Status.ACTIVE && syncEnabled && authRef != null && !authRef.isBlank();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getVersion() { return version; }
    public void setVersion(Long version) { this.version = version; }

    public String getTenantId() { return tenantId; }
    public void setTenantId(String tenantId) { this.tenantId = tenantId; }

    public String getEmployeeId() { return employeeId; }
    public void setEmployeeId(String employeeId) { this.employeeId = employeeId; }

    public String getProvider() { return provider; }
    public void setProvider(String provider) { this.provider = provider; }

    public String getAuthRef() { return authRef; }
    public void setAuthRef(String authRef) { this.authRef = authRef; }

    public Status getStatus() { return status; }
    public void setStatus(Status status) { this.status = status; }

    public boolean isSyncEnabled() { return syncEnabled; }
    public void setSyncEnabled(boolean syncEnabled) { this.syncEnabled = syncEnabled; }

    public Instant getLastSyncedAt() { return lastSyncedAt; }
    public void setLastSyncedAt(Instant lastSyncedAt) { this.lastSyncedAt = lastSyncedAt; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
