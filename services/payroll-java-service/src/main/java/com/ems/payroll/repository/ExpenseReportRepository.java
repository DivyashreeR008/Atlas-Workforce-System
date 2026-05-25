package com.ems.payroll.repository;

import com.ems.payroll.model.ExpenseReport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ExpenseReportRepository extends JpaRepository<ExpenseReport, Long> {
    List<ExpenseReport> findByTenantId(String tenantId);
    List<ExpenseReport> findByTenantIdAndEmployeeId(String tenantId, String employeeId);
    List<ExpenseReport> findByTenantIdAndStatus(String tenantId, String status);
    List<ExpenseReport> findByTenantIdAndCategory(String tenantId, String category);
}
