package com.ems.payroll.model;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "equity_grants")
public class EquityGrant {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String employeeId;
    private String tenantId;
    private Double shares;
    private Double strikePrice;
    private Double fairMarketValue;
    private LocalDate grantDate;
    private LocalDate vestingStart;
    private LocalDate vestingEnd;
    private String vestingSchedule;
    private String equityType;
    private String status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public EquityGrant() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getEmployeeId() { return employeeId; }
    public void setEmployeeId(String employeeId) { this.employeeId = employeeId; }
    public String getTenantId() { return tenantId; }
    public void setTenantId(String tenantId) { this.tenantId = tenantId; }
    public Double getShares() { return shares; }
    public void setShares(Double shares) { this.shares = shares; }
    public Double getStrikePrice() { return strikePrice; }
    public void setStrikePrice(Double strikePrice) { this.strikePrice = strikePrice; }
    public Double getFairMarketValue() { return fairMarketValue; }
    public void setFairMarketValue(Double fairMarketValue) { this.fairMarketValue = fairMarketValue; }
    public LocalDate getGrantDate() { return grantDate; }
    public void setGrantDate(LocalDate grantDate) { this.grantDate = grantDate; }
    public LocalDate getVestingStart() { return vestingStart; }
    public void setVestingStart(LocalDate vestingStart) { this.vestingStart = vestingStart; }
    public LocalDate getVestingEnd() { return vestingEnd; }
    public void setVestingEnd(LocalDate vestingEnd) { this.vestingEnd = vestingEnd; }
    public String getVestingSchedule() { return vestingSchedule; }
    public void setVestingSchedule(String vestingSchedule) { this.vestingSchedule = vestingSchedule; }
    public String getEquityType() { return equityType; }
    public void setEquityType(String equityType) { this.equityType = equityType; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
