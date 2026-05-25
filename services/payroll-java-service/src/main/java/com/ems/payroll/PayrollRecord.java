package com.ems.payroll;

import jakarta.persistence.*;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.PositiveOrZero;
import java.time.LocalDateTime;

@Entity
@Table(name = "payroll_records", indexes = {
    @Index(name = "idx_payroll_employee", columnList = "employeeId"),
    @Index(name = "idx_payroll_period", columnList = "period")
})
public class PayrollRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String employeeId;

    @Column(name = "tenant_id", nullable = false)
    private String tenantId;

    @Column(nullable = false)
    private String period;

    @Min(0) @PositiveOrZero
    private Double baseSalary;
    @Min(0) @PositiveOrZero
    private Double allowances;
    @Min(0) @PositiveOrZero
    private Double deductions;
    @Min(0) @PositiveOrZero
    private Double tax;
    @Min(0) @PositiveOrZero
    private Double netSalary;

    private String status;
    private LocalDateTime processedDate;

    public PayrollRecord() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getEmployeeId() { return employeeId; }
    public void setEmployeeId(String employeeId) { this.employeeId = employeeId; }
    public String getTenantId() { return tenantId; }
    public void setTenantId(String tenantId) { this.tenantId = tenantId; }
    public String getPeriod() { return period; }
    public void setPeriod(String period) { this.period = period; }
    public Double getBaseSalary() { return baseSalary; }
    public void setBaseSalary(Double baseSalary) { this.baseSalary = baseSalary; }
    public Double getAllowances() { return allowances; }
    public void setAllowances(Double allowances) { this.allowances = allowances; }
    public Double getDeductions() { return deductions; }
    public void setDeductions(Double deductions) { this.deductions = deductions; }
    public Double getTax() { return tax; }
    public void setTax(Double tax) { this.tax = tax; }
    public Double getNetSalary() { return netSalary; }
    public void setNetSalary(Double netSalary) { this.netSalary = netSalary; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public LocalDateTime getProcessedDate() { return processedDate; }
    public void setProcessedDate(LocalDateTime processedDate) { this.processedDate = processedDate; }
}
