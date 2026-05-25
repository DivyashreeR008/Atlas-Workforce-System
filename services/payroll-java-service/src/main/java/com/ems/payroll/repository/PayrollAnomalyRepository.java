package com.ems.payroll.repository;

import com.ems.payroll.model.PayrollAnomaly;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface PayrollAnomalyRepository extends JpaRepository<PayrollAnomaly, Long> {
    List<PayrollAnomaly> findByTenantId(String tenantId);
    List<PayrollAnomaly> findByTenantIdAndIsResolved(String tenantId, Boolean isResolved);
    List<PayrollAnomaly> findByTenantIdAndSeverity(String tenantId, String severity);
    List<PayrollAnomaly> findByTenantIdAndAnomalyType(String tenantId, String anomalyType);
}
