package com.ems.payroll.repository;

import com.ems.payroll.model.TaxBracket;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface TaxBracketRepository extends JpaRepository<TaxBracket, Long> {
    List<TaxBracket> findByTenantIdAndCountryAndTaxYearOrderByBracketOrder(String tenantId, String country, String taxYear);
    List<TaxBracket> findByTenantId(String tenantId);
}
