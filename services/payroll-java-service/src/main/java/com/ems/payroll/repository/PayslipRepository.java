package com.ems.payroll.repository;

import com.ems.payroll.model.Payslip;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface PayslipRepository extends JpaRepository<Payslip, Long> {
    List<Payslip> findByTenantId(String tenantId);
    List<Payslip> findByTenantIdAndEmployeeId(String tenantId, String employeeId);
    Optional<Payslip> findByPayrollId(Long payrollId);
}
