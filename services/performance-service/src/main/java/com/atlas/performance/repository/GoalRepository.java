package com.atlas.performance.repository;

import com.atlas.performance.model.Goal;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface GoalRepository extends JpaRepository<Goal, String> {
    List<Goal> findByTenantId(String tenantId);
    List<Goal> findByTenantIdAndEmployeeId(String tenantId, String employeeId);
    List<Goal> findByTenantIdAndStatus(String tenantId, String status);
    List<Goal> findByTenantIdAndCategory(String tenantId, String category);
    List<Goal> findByTenantIdAndEmployeeIdAndStatus(String tenantId, String employeeId, String status);
    Optional<Goal> findByIdAndTenantId(String id, String tenantId);
}
