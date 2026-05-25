package com.ems.payroll.repository;

import com.ems.payroll.model.CompensationPlan;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface CompensationPlanRepository extends JpaRepository<CompensationPlan, Long> {
    List<CompensationPlan> findByTenantId(String tenantId);
    List<CompensationPlan> findByTenantIdAndEmployeeId(String tenantId, String employeeId);
    List<CompensationPlan> findByTenantIdAndStatus(String tenantId, String status);
}
