package com.atlas.leave;

import jakarta.persistence.*;

/**
 * Per leave request x provider sync outcome. The (leaveId, provider) pair is
 * unique, so a duplicate approval event re-targets the same row and the
 * remote write stays idempotent via the idempotency key.
 */
@Entity
@Table(name = "calendar_sync_states",
        uniqueConstraints = @UniqueConstraint(name = "uq_state_leave_provider", columnNames = {"leaveId", "provider"}))
public class CalendarSyncState {

    public enum Status { SYNCED, FAILED, DELETED, SKIPPED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tenant_id", nullable = false)
    private String tenantId;

    @Column(nullable = false)
    private Long leaveId;

    /** Needed to re-resolve the connection on an explicit retry. */
    @Column(nullable = false)
    private String employeeId;

    @Column(nullable = false)
    private String provider;

    @Column(nullable = false)
    private String idempotencyKey;

    /** Event id as returned by the provider; needed to update/delete the block. */
    private String externalEventId;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private Status status;

    @Column(length = 500)
    private String failureReason;

    private int retryCount;

    private java.time.Instant lastAttemptAt;

    private java.time.Instant updatedAt;

    public CalendarSyncState() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getTenantId() { return tenantId; }
    public void setTenantId(String tenantId) { this.tenantId = tenantId; }

    public Long getLeaveId() { return leaveId; }
    public void setLeaveId(Long leaveId) { this.leaveId = leaveId; }

    public String getEmployeeId() { return employeeId; }
    public void setEmployeeId(String employeeId) { this.employeeId = employeeId; }

    public String getProvider() { return provider; }
    public void setProvider(String provider) { this.provider = provider; }

    public String getIdempotencyKey() { return idempotencyKey; }
    public void setIdempotencyKey(String idempotencyKey) { this.idempotencyKey = idempotencyKey; }

    public String getExternalEventId() { return externalEventId; }
    public void setExternalEventId(String externalEventId) { this.externalEventId = externalEventId; }

    public Status getStatus() { return status; }
    public void setStatus(Status status) { this.status = status; }

    public String getFailureReason() { return failureReason; }
    public void setFailureReason(String failureReason) { this.failureReason = failureReason; }

    public int getRetryCount() { return retryCount; }
    public void setRetryCount(int retryCount) { this.retryCount = retryCount; }

    public java.time.Instant getLastAttemptAt() { return lastAttemptAt; }
    public void setLastAttemptAt(java.time.Instant lastAttemptAt) { this.lastAttemptAt = lastAttemptAt; }

    public java.time.Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(java.time.Instant updatedAt) { this.updatedAt = updatedAt; }
}
