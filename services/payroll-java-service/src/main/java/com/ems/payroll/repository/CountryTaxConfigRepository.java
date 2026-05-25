package com.ems.payroll.repository;

import com.ems.payroll.model.CountryTaxConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface CountryTaxConfigRepository extends JpaRepository<CountryTaxConfig, Long> {
    List<CountryTaxConfig> findByTenantId(String tenantId);
    Optional<CountryTaxConfig> findByTenantIdAndCountry(String tenantId, String country);
    Optional<CountryTaxConfig> findByTenantIdAndCountryAndTaxYear(String tenantId, String country, String taxYear);
}
