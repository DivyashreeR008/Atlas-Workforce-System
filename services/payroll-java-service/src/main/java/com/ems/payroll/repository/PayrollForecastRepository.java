package com.ems.payroll.repository;

import com.ems.payroll.model.PayrollForecast;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface PayrollForecastRepository extends JpaRepository<PayrollForecast, Long> {
    List<PayrollForecast> findByTenantId(String tenantId);
    Optional<PayrollForecast> findByTenantIdAndPeriod(String tenantId, String period);
    List<PayrollForecast> findByTenantIdOrderByPeriodDesc(String tenantId);
}
