package com.ems.payroll.repository;

import com.ems.payroll.model.PayrollComplianceReport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface PayrollComplianceReportRepository extends JpaRepository<PayrollComplianceReport, Long> {
    List<PayrollComplianceReport> findByTenantId(String tenantId);
    List<PayrollComplianceReport> findByTenantIdAndPeriod(String tenantId, String period);
    List<PayrollComplianceReport> findByTenantIdAndReportType(String tenantId, String reportType);
}
