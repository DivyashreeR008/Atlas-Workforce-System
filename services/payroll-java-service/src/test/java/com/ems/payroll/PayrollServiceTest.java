package com.ems.payroll;

import com.ems.payroll.repository.OutboxEventRepository;
import com.ems.payroll.service.PayrollFailureOutboxWriter;
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

@ExtendWith(MockitoExtension.class)
class PayrollServiceTest {

    @Mock
    private PayrollRepository repository;

    @Mock
    private OutboxEventRepository outboxEventRepository;

    @Mock
    private PayrollFailureOutboxWriter failureOutbox;

    @InjectMocks
    private PayrollService service;

    @Test
    void runPayrollKeepsCentsExact() {
        when(repository.findByTenantIdAndEmployeeIdAndPeriod("t1", "e1", "2026-01"))
                .thenReturn(List.of());
        when(repository.saveAndFlush(any(PayrollRecord.class)))
                .thenAnswer(inv -> {
                    PayrollRecord saved = inv.getArgument(0);
                    // Mocked save must assign an id: runPayroll embeds it in the
                    // outbox payload via Map.of, which rejects null values.
                    saved.setId(1L);
                    return saved;
                });

        // 0.10 + 0.20 - 0.00 = 0.30 gross, below the 3000 tax threshold.
        PayrollRecord record = service.runPayroll(
                "t1", "e1", "2026-01",
                new BigDecimal("0.10"), new BigDecimal("0.20"), new BigDecimal("0.00"));

        assertEquals(new BigDecimal("0.30"), record.getNetSalary());
        assertEquals(new BigDecimal("0.00"), record.getTax());
    }

    @Test
    void awkwardSalaryProducesExactTaxAndNet() {
        when(repository.findByTenantIdAndEmployeeIdAndPeriod("t1", "e2", "2026-01"))
                .thenReturn(List.of());
        when(repository.saveAndFlush(any(PayrollRecord.class)))
                .thenAnswer(inv -> {
                    PayrollRecord saved = inv.getArgument(0);
                    // Mocked save must assign an id: runPayroll embeds it in the
                    // outbox payload via Map.of, which rejects null values.
                    saved.setId(2L);
                    return saved;
                });

        // 5000 gross: (5000 - 3000) * 15% = 300.00 tax, 4700.00 net.
        PayrollRecord record = service.runPayroll(
                "t1", "e2", "2026-01",
                new BigDecimal("4000.00"), new BigDecimal("1000.00"), new BigDecimal("0.00"));

        assertEquals(new BigDecimal("300.00"), record.getTax());
        assertEquals(new BigDecimal("4700.00"), record.getNetSalary());
    }

    @Test
    void duplicateConcurrentRunMapsToTheFriendlyError() {
        when(repository.findByTenantIdAndEmployeeIdAndPeriod("t1", "e3", "2026-01"))
                .thenReturn(List.of());
        // Both runs passed the pre-check; the unique index rejects the loser.
        when(repository.saveAndFlush(any(PayrollRecord.class)))
                .thenThrow(new DataIntegrityViolationException(
                        "could not execute statement [ERROR: duplicate key value violates unique constraint \""
                                + PayrollDuplicates.PAYROLL_RECORDS_PERIOD + "\"]"));

        IllegalArgumentException error = assertThrows(IllegalArgumentException.class, () -> service.runPayroll(
                "t1", "e3", "2026-01",
                new BigDecimal("5000.00"), new BigDecimal("0.00"), new BigDecimal("0.00")));

        assertEquals("Payroll already processed for this period", error.getMessage());
        // The failed run still leaves a failure event behind (written in its
        // own transaction by the writer).
        verify(failureOutbox).recordFailure("t1", "e3", "2026-01",
                "Payroll already processed for this period");
    }

    @Test
    void nonDuplicateConstraintViolationIsNotMasked() {
        String databaseError = "null value in column \"base_salary\" violates not-null constraint";
        when(repository.findByTenantIdAndEmployeeIdAndPeriod("t1", "e4", "2026-01"))
                .thenReturn(List.of());
        when(repository.saveAndFlush(any(PayrollRecord.class)))
                .thenThrow(new DataIntegrityViolationException(databaseError));

        DataIntegrityViolationException error = assertThrows(DataIntegrityViolationException.class,
                () -> service.runPayroll("t1", "e4", "2026-01",
                        new BigDecimal("5000.00"), new BigDecimal("0.00"), new BigDecimal("0.00")));

        assertEquals(databaseError, error.getMessage());
        verify(failureOutbox).recordFailure("t1", "e4", "2026-01", databaseError);
    }

    @Test
    void taxDefaultsKeepTheHistoricalBands() {
        assertEquals(new BigDecimal("0.00"), service.calculateTax(new BigDecimal("3000.00")));
        assertEquals(new BigDecimal("300.00"), service.calculateTax(new BigDecimal("5000.00")));
        // 4000 * 15% + 3000 * 25% = 600.00 + 750.00
        assertEquals(new BigDecimal("1350.00"), service.calculateTax(new BigDecimal("10000.00")));
        // 4000 * 15% + 5000 * 25% + 8000 * 35% = 600.00 + 1250.00 + 2800.00
        assertEquals(new BigDecimal("4650.00"), service.calculateTax(new BigDecimal("20000.00")));
    }

    @Test
    void taxBandsComeFromConfiguration() {
        ReflectionTestUtils.setField(service, "simpleTaxLowerLimit", new BigDecimal("1000.00"));
        ReflectionTestUtils.setField(service, "simpleTaxMiddleLimit", new BigDecimal("2000.00"));
        ReflectionTestUtils.setField(service, "simpleTaxUpperLimit", new BigDecimal("3000.00"));
        ReflectionTestUtils.setField(service, "simpleTaxLowRate", 0.10);
        ReflectionTestUtils.setField(service, "simpleTaxMiddleRate", 0.20);
        ReflectionTestUtils.setField(service, "simpleTaxHighRate", 0.30);

        // (2000 - 1000) * 10%
        assertEquals(new BigDecimal("100.00"), service.calculateTax(new BigDecimal("2000.00")));
        // 1000 * 10% + 1000 * 20% + 1000 * 30%
        assertEquals(new BigDecimal("600.00"), service.calculateTax(new BigDecimal("4000.00")));
    }

    @Test
    void batchSumsMatchTotalToTheCent() {
        java.math.BigDecimal total = com.ems.payroll.util.Money.sum(List.of(
                new BigDecimal("1234.56"),
                new BigDecimal("333.33"),
                new BigDecimal("0.10")));
        assertEquals(new BigDecimal("1567.99"), total);
    }
}
