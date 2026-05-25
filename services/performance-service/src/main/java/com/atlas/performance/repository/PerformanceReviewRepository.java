package com.atlas.performance.repository;

import com.atlas.performance.model.PerformanceReview;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PerformanceReviewRepository extends JpaRepository<PerformanceReview, String> {
    List<PerformanceReview> findByTenantId(String tenantId);
    List<PerformanceReview> findByTenantIdAndEmployeeId(String tenantId, String employeeId);
    List<PerformanceReview> findByTenantIdAndReviewerId(String tenantId, String reviewerId);
    List<PerformanceReview> findByTenantIdAndStatus(String tenantId, String status);
    List<PerformanceReview> findByTenantIdAndReviewCycle(String tenantId, String reviewCycle);
    Optional<PerformanceReview> findByIdAndTenantId(String id, String tenantId);
}
