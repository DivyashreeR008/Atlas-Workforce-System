package com.ems.payroll.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "payroll_forecasts")
public class PayrollForecast {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String tenantId;
    private String period;
    private Double projectedGrossPayroll;
    private Double projectedNetPayroll;
    private Double projectedTax;
    private Double projectedBenefits;
    private Double confidence;
    @Column(columnDefinition = "TEXT")
    private String factors;
    private String status;
    private LocalDateTime generatedAt;
    private LocalDateTime createdAt;

    public PayrollForecast() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getTenantId() { return tenantId; }
    public void setTenantId(String tenantId) { this.tenantId = tenantId; }
    public String getPeriod() { return period; }
    public void setPeriod(String period) { this.period = period; }
    public Double getProjectedGrossPayroll() { return projectedGrossPayroll; }
    public void setProjectedGrossPayroll(Double projectedGrossPayroll) { this.projectedGrossPayroll = projectedGrossPayroll; }
    public Double getProjectedNetPayroll() { return projectedNetPayroll; }
    public void setProjectedNetPayroll(Double projectedNetPayroll) { this.projectedNetPayroll = projectedNetPayroll; }
    public Double getProjectedTax() { return projectedTax; }
    public void setProjectedTax(Double projectedTax) { this.projectedTax = projectedTax; }
    public Double getProjectedBenefits() { return projectedBenefits; }
    public void setProjectedBenefits(Double projectedBenefits) { this.projectedBenefits = projectedBenefits; }
    public Double getConfidence() { return confidence; }
    public void setConfidence(Double confidence) { this.confidence = confidence; }
    public String getFactors() { return factors; }
    public void setFactors(String factors) { this.factors = factors; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public LocalDateTime getGeneratedAt() { return generatedAt; }
    public void setGeneratedAt(LocalDateTime generatedAt) { this.generatedAt = generatedAt; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
