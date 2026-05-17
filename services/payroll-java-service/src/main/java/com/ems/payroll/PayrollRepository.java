package com.ems.payroll;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PayrollRepository extends JpaRepository<PayrollRecord, Long> {
    List<PayrollRecord> findByEmployeeId(String employeeId);
    List<PayrollRecord> findByPeriod(String period);
    List<PayrollRecord> findByEmployeeIdAndPeriod(String employeeId, String period);
}
