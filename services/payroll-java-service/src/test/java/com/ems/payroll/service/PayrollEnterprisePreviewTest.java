package com.ems.payroll.service;

import com.ems.payroll.model.EnhancedPayrollRecord;
import com.ems.payroll.model.PayrollPreview;
import com.ems.payroll.repository.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Batch and single payroll dry-run: the same component resolution and tax
 * computation as the committed path, but nothing persisted. A DB-state diff
 * between a preview and a committed run must show zero differences
 * attributable to the preview, asserted here save-for-save.
 */
@ExtendWith(MockitoExtension.class)
class PayrollEnterprisePreviewTest {

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

    private void batchResolutions() {
        when(payrollRepo.findByTenantIdAndEmployeeId("t1", "e1")).thenReturn(List.of());
        when(payrollRepo.findByTenantIdAndEmployeeId("t1", "e2")).thenReturn(List.of());
        when(compensationRepo.findByTenantIdAndEmployeeId("t1", "e1")).thenReturn(List.of());
        when(compensationRepo.findByTenantIdAndEmployeeId("t1", "e2")).thenReturn(List.of());
        when(payrollRepo.findByTenantIdAndEmployeeIdAndPeriod(any(), any(), any())).thenReturn(List.of());
    }

    @Test
    void batchDryRunWritesNothing() {
        batchResolutions();

        Map<String, Object> result = service.runBatchPayroll("t1", "2026-01", List.of("e1", "e2"),
                new BigDecimal("4000.00"), new BigDecimal("1000.00"), new BigDecimal("0.00"),
                "US", "USD", true);

        assertEquals(2, result.get("processed"));
        assertEquals(0, result.get("failed"));
        assertEquals(true, result.get("dryRun"));

        // Zero side effects across every write path of a committed run.
        verify(payrollRepo, never()).saveAndFlush(any(EnhancedPayrollRecord.class));
        verifyNoInteractions(payslipRepo);
        verifyNoInteractions(auditRepo);
        verifyNoInteractions(anomalyRepo);
        verifyNoInteractions(outboxEventRepository);
    }

    @Test
    void batchDryRunTotalsMatchTheKnownFixture() {
        batchResolutions();

        Map<String, Object> result = service.runBatchPayroll("t1", "2026-01", List.of("e1", "e2"),
                new BigDecimal("4000.00"), new BigDecimal("1000.00"), new BigDecimal("0.00"),
                "US", "USD", true);

        @SuppressWarnings("unchecked")
        Map<String, Object> totals = (Map<String, Object>) result.get("previewTotals");
        // Two employees at 5000 gross, 300 tax, 4700 net each.
        assertEquals(new BigDecimal("10000.00"), totals.get("gross"));
        assertEquals(new BigDecimal("600.00"), totals.get("tax"));
        assertEquals(new BigDecimal("9400.00"), totals.get("net"));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> previews = (List<Map<String, Object>>) result.get("employeePreviews");
        assertEquals(2, previews.size());
        assertEquals("PREVIEW", previews.get(0).get("status"));
    }

    @Test
    void batchDryRunSurfacesMissingTaxConfiguration() {
        batchResolutions();

        Map<String, Object> result = service.runBatchPayroll("t1", "2026-01", List.of("e1"),
                new BigDecimal("4000.00"), new BigDecimal("1000.00"), new BigDecimal("0.00"),
                "US", "USD", true);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> previews = (List<Map<String, Object>>) result.get("employeePreviews");
        @SuppressWarnings("unchecked")
        List<String> warnings = (List<String>) previews.get(0).get("warnings");
        assertTrue(warnings.stream().anyMatch(w -> w.contains("no country tax configuration")));
    }

    @Test
    void committedBatchStillPersistsAndRecordsProgress() {
        when(payrollRepo.findByTenantIdAndEmployeeIdAndPeriod(any(), any(), any())).thenReturn(List.of());
        when(payrollRepo.findByTenantIdAndEmployeeId("t1", "e1")).thenReturn(List.of());
        when(compensationRepo.findByTenantIdAndEmployeeId("t1", "e1")).thenReturn(List.of());
        when(payrollRepo.saveAndFlush(any(EnhancedPayrollRecord.class))).thenAnswer(inv -> {
            EnhancedPayrollRecord saved = inv.getArgument(0);
            saved.setId(1L);
            return saved;
        });

        Map<String, Object> result = service.runBatchPayroll("t1", "2026-01", List.of("e1"),
                new BigDecimal("4000.00"), new BigDecimal("1000.00"), new BigDecimal("0.00"),
                "US", "USD", false);

        assertEquals(1, result.get("processed"));
        verify(payrollRepo).saveAndFlush(any(EnhancedPayrollRecord.class));
        verify(auditRepo).save(any(com.ems.payroll.model.PayrollAudit.class));
        verify(outboxEventRepository).save(any(com.ems.payroll.model.OutboxEvent.class));
        verify(payslipRepo).save(any(com.ems.payroll.model.Payslip.class));
    }

    @Test
    void previewMatchesTheCommittedNumbers() {
        when(payrollRepo.findByTenantIdAndEmployeeIdAndPeriod("t1", "e1", "2026-01")).thenReturn(List.of());
        when(payrollRepo.saveAndFlush(any(EnhancedPayrollRecord.class))).thenAnswer(inv -> {
            EnhancedPayrollRecord saved = inv.getArgument(0);
            saved.setId(2L);
            return saved;
        });

        PayrollPreview preview = service.previewMultiCountryPayroll("t1", "e1", "2026-01",
                new BigDecimal("4000.00"), new BigDecimal("1000.00"), new BigDecimal("0.00"), "US", "USD");
        EnhancedPayrollRecord committed = service.runMultiCountryPayroll("t1", "e1", "2026-01",
                new BigDecimal("4000.00"), new BigDecimal("1000.00"), new BigDecimal("0.00"), "US", "USD");

        assertEquals(preview.tax(), committed.getTax());
        assertEquals(preview.netSalary(), committed.getNetSalary());
        assertEquals(preview.socialSecurity(), committed.getSocialSecurity());
        assertEquals(preview.medicare(), committed.getMedicare());
        // Gross parity: with zero deductions, tax + net reconstructs gross.
        assertEquals(preview.grossSalary(), committed.getTax().add(committed.getNetSalary()));
        assertEquals("PREVIEW", preview.status());
    }
}
