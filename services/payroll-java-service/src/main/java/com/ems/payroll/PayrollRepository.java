package com.ems.payroll;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PayrollRepository extends JpaRepository<PayrollRecord, Long> {
    List<PayrollRecord> findByTenantId(String tenantId);
    List<PayrollRecord> findByTenantIdAndEmployeeId(String tenantId, String employeeId);
    List<PayrollRecord> findByTenantIdAndPeriod(String tenantId, String period);
    List<PayrollRecord> findByTenantIdAndEmployeeIdAndPeriod(String tenantId, String employeeId, String period);
}
