package com.atlas.performance.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "succession_plans", indexes = {
    @Index(name = "idx_splan_tenant", columnList = "tenant_id"),
    @Index(name = "idx_splan_position", columnList = "position"),
    @Index(name = "idx_splan_department", columnList = "department")
})
public class SuccessionPlan {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(name = "tenant_id", nullable = false, length = 50)
    private String tenantId;

    @Column(nullable = false, length = 200)
    private String position;

    @Column(length = 100)
    private String department;

    @Column(name = "current_holder_id", length = 100)
    private String currentHolderId;

    @Column(length = 30)
    private String readiness;

    @Column(name = "risk_of_loss", length = 20)
    private String riskOfLoss;

    @Column(length = 20)
    private String status = "ACTIVE";

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public SuccessionPlan() {}

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getTenantId() { return tenantId; }
    public void setTenantId(String tenantId) { this.tenantId = tenantId; }
    public String getPosition() { return position; }
    public void setPosition(String position) { this.position = position; }
    public String getDepartment() { return department; }
    public void setDepartment(String department) { this.department = department; }
    public String getCurrentHolderId() { return currentHolderId; }
    public void setCurrentHolderId(String currentHolderId) { this.currentHolderId = currentHolderId; }
    public String getReadiness() { return readiness; }
    public void setReadiness(String readiness) { this.readiness = readiness; }
    public String getRiskOfLoss() { return riskOfLoss; }
    public void setRiskOfLoss(String riskOfLoss) { this.riskOfLoss = riskOfLoss; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
