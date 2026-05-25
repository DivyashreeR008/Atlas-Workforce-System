package com.ems.payroll.repository;

import com.ems.payroll.model.EnhancedPayrollRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface EnhancedPayrollRepository extends JpaRepository<EnhancedPayrollRecord, Long> {
    List<EnhancedPayrollRecord> findByTenantId(String tenantId);
    List<EnhancedPayrollRecord> findByTenantIdAndEmployeeId(String tenantId, String employeeId);
    List<EnhancedPayrollRecord> findByTenantIdAndPeriod(String tenantId, String period);
    List<EnhancedPayrollRecord> findByTenantIdAndEmployeeIdAndPeriod(String tenantId, String employeeId, String period);
    List<EnhancedPayrollRecord> findByTenantIdAndCountry(String tenantId, String country);
    List<EnhancedPayrollRecord> findByTenantIdAndStatus(String tenantId, String status);

    @Query("SELECT COALESCE(SUM(e.baseSalary), 0) FROM EnhancedPayrollRecord e WHERE e.tenantId = ?1 AND e.period = ?2")
    Double sumBaseSalaryByTenantAndPeriod(String tenantId, String period);

    @Query("SELECT COALESCE(SUM(e.tax), 0) FROM EnhancedPayrollRecord e WHERE e.tenantId = ?1 AND e.period = ?2")
    Double sumTaxByTenantAndPeriod(String tenantId, String period);

    @Query("SELECT COALESCE(SUM(e.netSalary), 0) FROM EnhancedPayrollRecord e WHERE e.tenantId = ?1 AND e.period = ?2")
    Double sumNetSalaryByTenantAndPeriod(String tenantId, String period);

    @Query("SELECT COALESCE(SUM(e.grossSalary), 0) FROM EnhancedPayrollRecord e WHERE e.tenantId = ?1")
    Double sumGrossSalaryByTenant(String tenantId);
}
