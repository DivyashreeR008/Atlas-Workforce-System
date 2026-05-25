package com.atlas.performance.repository;

import com.atlas.performance.model.Feedback360;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface Feedback360Repository extends JpaRepository<Feedback360, String> {
    List<Feedback360> findByTenantId(String tenantId);
    List<Feedback360> findByTenantIdAndEmployeeId(String tenantId, String employeeId);
    List<Feedback360> findByTenantIdAndReviewerId(String tenantId, String reviewerId);
    List<Feedback360> findByTenantIdAndReviewId(String tenantId, String reviewId);
    Optional<Feedback360> findByIdAndTenantId(String id, String tenantId);
}
