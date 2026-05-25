package com.ems.payroll.repository;

import com.ems.payroll.model.BankTransaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface BankTransactionRepository extends JpaRepository<BankTransaction, Long> {
    List<BankTransaction> findByTenantId(String tenantId);
    List<BankTransaction> findByTenantIdAndEmployeeId(String tenantId, String employeeId);
    List<BankTransaction> findByTenantIdAndStatus(String tenantId, String status);
}
