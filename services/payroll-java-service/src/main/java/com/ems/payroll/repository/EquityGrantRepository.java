package com.ems.payroll.repository;

import com.ems.payroll.model.EquityGrant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface EquityGrantRepository extends JpaRepository<EquityGrant, Long> {
    List<EquityGrant> findByTenantId(String tenantId);
    List<EquityGrant> findByTenantIdAndEmployeeId(String tenantId, String employeeId);
    List<EquityGrant> findByTenantIdAndStatus(String tenantId, String status);
    List<EquityGrant> findByTenantIdAndEquityType(String tenantId, String equityType);
}
