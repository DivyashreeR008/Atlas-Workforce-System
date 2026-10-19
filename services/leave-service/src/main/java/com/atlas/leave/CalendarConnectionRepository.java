package com.atlas.leave;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CalendarConnectionRepository extends JpaRepository<CalendarConnection, Long> {

    Optional<CalendarConnection> findByTenantIdAndEmployeeIdAndProvider(String tenantId, String employeeId, String provider);

    List<CalendarConnection> findByTenantIdAndEmployeeId(String tenantId, String employeeId);

    List<CalendarConnection> findByTenantIdAndEmployeeIdAndStatus(String tenantId, String employeeId, CalendarConnection.Status status);
}
