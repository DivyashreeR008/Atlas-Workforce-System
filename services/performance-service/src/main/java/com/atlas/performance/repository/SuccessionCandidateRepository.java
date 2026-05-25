package com.atlas.performance.repository;

import com.atlas.performance.model.SuccessionCandidate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SuccessionCandidateRepository extends JpaRepository<SuccessionCandidate, String> {
    List<SuccessionCandidate> findByTenantId(String tenantId);
    List<SuccessionCandidate> findByTenantIdAndPlanId(String tenantId, String planId);
    List<SuccessionCandidate> findByTenantIdAndEmployeeId(String tenantId, String employeeId);
    List<SuccessionCandidate> findByTenantIdAndStatus(String tenantId, String status);
    Optional<SuccessionCandidate> findByIdAndTenantId(String id, String tenantId);
}
