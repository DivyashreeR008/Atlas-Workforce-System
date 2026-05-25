package com.ems.payroll.repository;

import com.ems.payroll.model.SalaryBenchmark;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface SalaryBenchmarkRepository extends JpaRepository<SalaryBenchmark, Long> {
    List<SalaryBenchmark> findByTenantId(String tenantId);
    Optional<SalaryBenchmark> findByTenantIdAndRoleAndExperienceAndLocation(String tenantId, String role, String experience, String location);
    List<SalaryBenchmark> findByTenantIdAndRole(String tenantId, String role);
}
