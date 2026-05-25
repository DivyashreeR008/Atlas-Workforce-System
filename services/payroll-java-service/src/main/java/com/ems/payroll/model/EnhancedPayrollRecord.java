package com.ems.payroll.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.PositiveOrZero;
import java.time.LocalDateTime;

@Entity
@Table(name = "enhanced_payroll_records", indexes = {
    @Index(name = "idx_epr_employee", columnList = "employeeId"),
    @Index(name = "idx_epr_period", columnList = "period")
})
public class EnhancedPayrollRecord {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String employeeId;
    private String tenantId;
    private String period;
    private String country;
    private String currency;
    @Min(0) @PositiveOrZero
    private Double baseSalary;
    @Min(0) @PositiveOrZero
    private Double allowances;
    @Min(0) @PositiveOrZero
    private Double deductions;
    @Min(0) @PositiveOrZero
    private Double tax;
    @Min(0) @PositiveOrZero
    private Double socialSecurity;
    @Min(0) @PositiveOrZero
    private Double medicare;
    @Min(0) @PositiveOrZero
    private Double netSalary;
    @Min(0) @PositiveOrZero
    private Double grossSalary;
    private String paymentMethod;
    private String bankAccount;
    private String bankRouting;
    private String status;
    private LocalDateTime processedDate;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public EnhancedPayrollRecord() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getEmployeeId() { return employeeId; }
    public void setEmployeeId(String employeeId) { this.employeeId = employeeId; }
    public String getTenantId() { return tenantId; }
    public void setTenantId(String tenantId) { this.tenantId = tenantId; }
    public String getPeriod() { return period; }
    public void setPeriod(String period) { this.period = period; }
    public String getCountry() { return country; }
    public void setCountry(String country) { this.country = country; }
    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }
    public Double getBaseSalary() { return baseSalary; }
    public void setBaseSalary(Double baseSalary) { this.baseSalary = baseSalary; }
    public Double getAllowances() { return allowances; }
    public void setAllowances(Double allowances) { this.allowances = allowances; }
    public Double getDeductions() { return deductions; }
    public void setDeductions(Double deductions) { this.deductions = deductions; }
    public Double getTax() { return tax; }
    public void setTax(Double tax) { this.tax = tax; }
    public Double getSocialSecurity() { return socialSecurity; }
    public void setSocialSecurity(Double socialSecurity) { this.socialSecurity = socialSecurity; }
    public Double getMedicare() { return medicare; }
    public void setMedicare(Double medicare) { this.medicare = medicare; }
    public Double getNetSalary() { return netSalary; }
    public void setNetSalary(Double netSalary) { this.netSalary = netSalary; }
    public Double getGrossSalary() { return grossSalary; }
    public void setGrossSalary(Double grossSalary) { this.grossSalary = grossSalary; }
    public String getPaymentMethod() { return paymentMethod; }
    public void setPaymentMethod(String paymentMethod) { this.paymentMethod = paymentMethod; }
    public String getBankAccount() { return bankAccount; }
    public void setBankAccount(String bankAccount) { this.bankAccount = bankAccount; }
    public String getBankRouting() { return bankRouting; }
    public void setBankRouting(String bankRouting) { this.bankRouting = bankRouting; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public LocalDateTime getProcessedDate() { return processedDate; }
    public void setProcessedDate(LocalDateTime processedDate) { this.processedDate = processedDate; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
