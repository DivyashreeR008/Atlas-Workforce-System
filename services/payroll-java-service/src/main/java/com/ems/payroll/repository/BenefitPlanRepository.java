package com.ems.payroll.repository;

import com.ems.payroll.model.BenefitPlan;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface BenefitPlanRepository extends JpaRepository<BenefitPlan, Long> {
    List<BenefitPlan> findByTenantId(String tenantId);
    List<BenefitPlan> findByTenantIdAndIsActive(String tenantId, Boolean isActive);
    List<BenefitPlan> findByTenantIdAndType(String tenantId, String type);
}
