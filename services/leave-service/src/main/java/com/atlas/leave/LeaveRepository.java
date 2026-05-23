package com.atlas.leave;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LeaveRepository extends JpaRepository<LeaveRecord, Long> {
    List<LeaveRecord> findByTenantId(String tenantId);
    List<LeaveRecord> findByTenantIdAndEmployeeId(String tenantId, String employeeId);
    List<LeaveRecord> findByTenantIdAndStatus(String tenantId, String status);
    // Needed for updateLeaveStatus logic
    java.util.Optional<LeaveRecord> findByIdAndTenantId(Long id, String tenantId);
}
