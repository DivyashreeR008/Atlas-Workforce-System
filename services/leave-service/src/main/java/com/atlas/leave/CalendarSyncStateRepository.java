package com.atlas.leave;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CalendarSyncStateRepository extends JpaRepository<CalendarSyncState, Long> {

    Optional<CalendarSyncState> findByLeaveIdAndProvider(Long leaveId, String provider);

    List<CalendarSyncState> findByTenantIdAndLeaveId(String tenantId, Long leaveId);
}
