package com.ems.payroll.repository;

import com.ems.payroll.model.BenefitEnrollment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface BenefitEnrollmentRepository extends JpaRepository<BenefitEnrollment, Long> {
    List<BenefitEnrollment> findByTenantId(String tenantId);
    List<BenefitEnrollment> findByTenantIdAndEmployeeId(String tenantId, String employeeId);
    List<BenefitEnrollment> findByTenantIdAndPlanId(String tenantId, Long planId);
    List<BenefitEnrollment> findByTenantIdAndStatus(String tenantId, String status);
}
