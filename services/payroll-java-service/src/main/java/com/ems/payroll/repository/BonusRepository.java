package com.ems.payroll.repository;

import com.ems.payroll.model.Bonus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface BonusRepository extends JpaRepository<Bonus, Long> {
    List<Bonus> findByTenantId(String tenantId);
    List<Bonus> findByTenantIdAndEmployeeId(String tenantId, String employeeId);
    List<Bonus> findByTenantIdAndType(String tenantId, String type);
    List<Bonus> findByTenantIdAndStatus(String tenantId, String status);
}
