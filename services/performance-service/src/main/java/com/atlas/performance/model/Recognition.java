package com.atlas.performance.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "recognitions", indexes = {
    @Index(name = "idx_recognition_tenant", columnList = "tenant_id"),
    @Index(name = "idx_recognition_to", columnList = "to_employee_id"),
    @Index(name = "idx_recognition_from", columnList = "from_employee_id")
})
public class Recognition {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(name = "tenant_id", nullable = false, length = 50)
    private String tenantId;

    @Column(name = "from_employee_id", length = 100)
    private String fromEmployeeId;

    @Column(name = "to_employee_id", nullable = false, length = 100)
    private String toEmployeeId;

    @Column(length = 30)
    private String category;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String message;

    @Column(length = 50)
    private String badge;

    @Column
    private Integer points = 1;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public Recognition() {}

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getTenantId() { return tenantId; }
    public void setTenantId(String tenantId) { this.tenantId = tenantId; }
    public String getFromEmployeeId() { return fromEmployeeId; }
    public void setFromEmployeeId(String fromEmployeeId) { this.fromEmployeeId = fromEmployeeId; }
    public String getToEmployeeId() { return toEmployeeId; }
    public void setToEmployeeId(String toEmployeeId) { this.toEmployeeId = toEmployeeId; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    public String getBadge() { return badge; }
    public void setBadge(String badge) { this.badge = badge; }
    public Integer getPoints() { return points; }
    public void setPoints(Integer points) { this.points = points; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
