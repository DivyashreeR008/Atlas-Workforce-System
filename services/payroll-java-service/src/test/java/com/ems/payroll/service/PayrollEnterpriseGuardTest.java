package com.ems.payroll.service;

import com.ems.payroll.model.EnhancedPayrollRecord;
import com.ems.payroll.repository.BankTransactionRepository;
import com.ems.payroll.repository.BenefitEnrollmentRepository;
import com.ems.payroll.repository.BenefitPlanRepository;
import com.ems.payroll.repository.BonusRepository;
import com.ems.payroll.repository.CompensationPlanRepository;
import com.ems.payroll.repository.CountryTaxConfigRepository;
import com.ems.payroll.repository.EnhancedPayrollRepository;
import com.ems.payroll.repository.EquityGrantRepository;
import com.ems.payroll.repository.ExpenseReportRepository;
import com.ems.payroll.repository.OutboxEventRepository;
import com.ems.payroll.repository.PayrollAnomalyRepository;
import com.ems.payroll.repository.PayrollAuditRepository;
import com.ems.payroll.repository.PayrollComplianceReportRepository;
import com.ems.payroll.repository.PayrollForecastRepository;
import com.ems.payroll.repository.PayslipRepository;
import com.ems.payroll.repository.SalaryBenchmarkRepository;
import com.ems.payroll.repository.TaxBracketRepository;
import com.ems.payroll.util.PayrollDuplicates;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Covers the #372 guards on the enterprise payroll path: the database-level
 * duplicate guard and its friendly mapping, the failure outbox delegation, and
 * the externalized simple-tax bands.
 */
@ExtendWith(MockitoExtension.class)
class PayrollEnterpriseGuardTest {

    @Mock private EnhancedPayrollRepository payrollRepo;
    @Mock private CountryTaxConfigRepository taxConfigRepo;
    @Mock private TaxBracketRepository taxBracketRepo;
    @Mock private PayrollAuditRepository auditRepo;
    @Mock private ExpenseReportRepository expenseRepo;
    @Mock private BenefitPlanRepository benefitPlanRepo;
    @Mock private BenefitEnrollmentRepository benefitEnrollRepo;
    @Mock private BonusRepository bonusRepo;
    @Mock private EquityGrantRepository equityRepo;
    @Mock private CompensationPlanRepository compensationRepo;
    @Mock private SalaryBenchmarkRepository benchmarkRepo;
    @Mock private PayrollForecastRepository forecastRepo;
    @Mock private BankTransactionRepository bankRepo;
    @Mock private PayrollComplianceReportRepository complianceRepo;
    @Mock private PayrollAnomalyRepository anomalyRepo;
    @Mock private PayslipRepository payslipRepo;
    @Mock private OutboxEventRepository outboxEventRepository;
    @Mock private PayrollFailureOutboxWriter failureOutbox;

    @InjectMocks
    private PayrollEnterpriseService service;

    @Test
    void duplicateConcurrentRunMapsToTheFriendlyError() {
        when(payrollRepo.findByTenantIdAndEmployeeIdAndPeriod("t1", "e1", "2026-01"))
                .thenReturn(List.of());
        // Both runs passed the pre-check; the unique index rejects the loser.
        when(payrollRepo.saveAndFlush(any(EnhancedPayrollRecord.class)))
                .thenThrow(new DataIntegrityViolationException(
                        "could not execute statement [ERROR: duplicate key value violates unique constraint \""
                                + PayrollDuplicates.ENHANCED_PAYROLL_RECORDS_PERIOD + "\"]"));

        IllegalArgumentException error = assertThrows(IllegalArgumentException.class,
                () -> service.runMultiCountryPayroll("t1", "e1", "2026-01",
                        new BigDecimal("5000.00"), new BigDecimal("0.00"), new BigDecimal("0.00"), "US", "USD"));

        assertEquals("Payroll already processed for this period", error.getMessage());
        verify(failureOutbox).recordFailure("t1", "e1", "2026-01",
                "Payroll already processed for this period");
    }

    @Test
    void preCheckFailureAlsoLeavesAFailureEvent() {
        EnhancedPayrollRecord existing = new EnhancedPayrollRecord();
        existing.setId(7L);
        existing.setTenantId("t1");
        existing.setEmployeeId("e2");
        existing.setPeriod("2026-01");
        when(payrollRepo.findByTenantIdAndEmployeeIdAndPeriod("t1", "e2", "2026-01"))
                .thenReturn(List.of(existing));

        assertThrows(IllegalArgumentException.class,
                () -> service.runMultiCountryPayroll("t1", "e2", "2026-01",
                        new BigDecimal("5000.00"), new BigDecimal("0.00"), new BigDecimal("0.00"), "US", "USD"));

        verify(failureOutbox).recordFailure("t1", "e2", "2026-01",
                "Payroll already processed for this period");
    }

    @Test
    void nonDuplicateConstraintViolationIsNotMasked() {
        String databaseError = "null value in column \"period\" violates not-null constraint";
        when(payrollRepo.findByTenantIdAndEmployeeIdAndPeriod("t1", "e3", "2026-01"))
                .thenReturn(List.of());
        when(payrollRepo.saveAndFlush(any(EnhancedPayrollRecord.class)))
                .thenThrow(new DataIntegrityViolationException(databaseError));

        assertThrows(DataIntegrityViolationException.class,
                () -> service.runMultiCountryPayroll("t1", "e3", "2026-01",
                        new BigDecimal("5000.00"), new BigDecimal("0.00"), new BigDecimal("0.00"), "US", "USD"));

        verify(failureOutbox).recordFailure("t1", "e3", "2026-01", databaseError);
    }

    @Test
    void simpleTaxDefaultsKeepTheHistoricalMath() {
        assertEquals(new BigDecimal("0.00"), service.calculateSimpleTax(new BigDecimal("3000.00")));
        assertEquals(new BigDecimal("300.00"), service.calculateSimpleTax(new BigDecimal("5000.00")));
        // 4000 * 15% + 3000 * 25%
        assertEquals(new BigDecimal("1350.00"), service.calculateSimpleTax(new BigDecimal("10000.00")));
        // 4000 * 15% + 5000 * 25% + 8000 * 35%
        assertEquals(new BigDecimal("4650.00"), service.calculateSimpleTax(new BigDecimal("20000.00")));
    }

    @Test
    void simpleTaxBandsComeFromConfiguration() {
        ReflectionTestUtils.setField(service, "simpleTaxLowerLimit", new BigDecimal("1000.00"));
        ReflectionTestUtils.setField(service, "simpleTaxMiddleLimit", new BigDecimal("2000.00"));
        ReflectionTestUtils.setField(service, "simpleTaxUpperLimit", new BigDecimal("3000.00"));
        ReflectionTestUtils.setField(service, "simpleTaxLowRate", 0.10);
        ReflectionTestUtils.setField(service, "simpleTaxMiddleRate", 0.20);
        ReflectionTestUtils.setField(service, "simpleTaxHighRate", 0.30);

        // (2000 - 1000) * 10%
        assertEquals(new BigDecimal("100.00"), service.calculateSimpleTax(new BigDecimal("2000.00")));
        // 1000 * 10% + 1000 * 20% + 1000 * 30%
        assertEquals(new BigDecimal("600.00"), service.calculateSimpleTax(new BigDecimal("4000.00")));
    }
}
