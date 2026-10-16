package com.atlas.performance.repository;

import com.atlas.performance.model.SuccessionPlan;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SuccessionPlanRepository extends JpaRepository<SuccessionPlan, String> {
    List<SuccessionPlan> findByTenantId(String tenantId);
    Page<SuccessionPlan> findByTenantId(String tenantId, Pageable pageable);
    List<SuccessionPlan> findByTenantIdAndDepartment(String tenantId, String department);
    List<SuccessionPlan> findByTenantIdAndStatus(String tenantId, String status);
    Optional<SuccessionPlan> findByIdAndTenantId(String id, String tenantId);
}
