package com.ems.payroll.repository;

import com.ems.payroll.model.PayrollAudit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface PayrollAuditRepository extends JpaRepository<PayrollAudit, Long> {
    List<PayrollAudit> findByTenantId(String tenantId);
    List<PayrollAudit> findByPayrollId(Long payrollId);
    List<PayrollAudit> findByTenantIdAndAction(String tenantId, String action);
}
