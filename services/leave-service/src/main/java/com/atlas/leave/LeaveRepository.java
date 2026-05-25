package com.atlas.leave;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface LeaveRepository extends JpaRepository<LeaveRecord, Long> {
    List<LeaveRecord> findByTenantId(String tenantId);
    List<LeaveRecord> findByTenantIdAndEmployeeId(String tenantId, String employeeId);
    List<LeaveRecord> findByTenantIdAndStatus(String tenantId, String status);
    // Needed for updateLeaveStatus logic
    java.util.Optional<LeaveRecord> findByIdAndTenantId(Long id, String tenantId);

    @Query("SELECT l FROM LeaveRecord l WHERE l.employeeId = :employeeId " +
           "AND l.startDate <= :endDate AND l.endDate >= :startDate " +
           "AND l.status NOT IN ('CANCELLED', 'REJECTED') " +
           "AND (:excludedId IS NULL OR l.id <> :excludedId)")
    List<LeaveRecord> findOverlapping(@Param("employeeId") String employeeId,
                                      @Param("startDate") LocalDate startDate,
                                      @Param("endDate") LocalDate endDate,
                                      @Param("excludedId") Long excludedId);

    List<LeaveRecord> findByTenantIdAndEmployeeIdAndStatusIn(String tenantId, String employeeId, List<LeaveStatus> statuses);
}
