package com.ems.payroll;

import com.ems.payroll.model.PayrollPreview;
import com.ems.payroll.repository.OutboxEventRepository;
import com.ems.payroll.service.PayrollFailureOutboxWriter;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Dry-run / preview mode: identical computation, zero side effects. The DB
 * state difference between a preview and a run must be exactly nothing, so
 * these tests assert saves never happen, not just that the return value
 * looks right.
 */
@ExtendWith(MockitoExtension.class)
class PayrollDryRunTest {

    @Mock
    private PayrollRepository repository;

    @Mock
    private OutboxEventRepository outboxEventRepository;

    @Mock
    private PayrollFailureOutboxWriter failureOutbox;

    @InjectMocks
    private PayrollService service;

    private void noStalePeriodRecords() {
        when(repository.findByTenantIdAndEmployeeIdAndPeriod("t1", "e1", "2026-01")).thenReturn(List.of());
    }

    @Test
    void dryRunWritesNothing() {
        noStalePeriodRecords();

        PayrollPreview preview = service.previewPayroll(
                "t1", "e1", "2026-01",
                new BigDecimal("4000.00"), new BigDecimal("1000.00"), new BigDecimal("0.00"));

        // 5000 gross -> 300.00 tax, 4700.00 net (known fixture).
        assertEquals(new BigDecimal("5000.00"), preview.grossSalary());
        assertEquals(new BigDecimal("300.00"), preview.tax());
        assertEquals(new BigDecimal("4700.00"), preview.netSalary());

        // Zero side effects: no payroll row, no outbox event, no failure row.
        verify(repository, org.mockito.Mockito.never()).saveAndFlush(any(PayrollRecord.class));
        verifyNoInteractions(outboxEventRepository);
        verifyNoInteractions(failureOutbox);
    }

    @Test
    void previewIsExplicitlyNonFinal() {
        noStalePeriodRecords();

        PayrollPreview preview = service.previewPayroll(
                "t1", "e1", "2026-01",
                new BigDecimal("4000.00"), new BigDecimal("1000.00"), new BigDecimal("0.00"));

        assertEquals("PREVIEW", preview.status());
        assertFalse(preview.status().equals("PROCESSED"));
    }

    @Test
    void commitAfterPreviewMatchesThePreviewedNumbers() {
        noStalePeriodRecords();
        when(repository.saveAndFlush(any(PayrollRecord.class))).thenAnswer(inv -> {
            PayrollRecord saved = inv.getArgument(0);
            saved.setId(9L);
            return saved;
        });

        PayrollPreview preview = service.previewPayroll(
                "t1", "e1", "2026-01",
                new BigDecimal("4000.00"), new BigDecimal("1000.00"), new BigDecimal("0.00"));
        PayrollRecord committed = service.runPayroll(
                "t1", "e1", "2026-01",
                new BigDecimal("4000.00"), new BigDecimal("1000.00"), new BigDecimal("0.00"));

        assertEquals(preview.tax(), committed.getTax());
        assertEquals(preview.netSalary(), committed.getNetSalary());
        // Gross parity: with 0.00 deductions and the known fixture, the
        // committed tax + net must reconstruct the preview gross exactly.
        assertEquals(preview.grossSalary(), committed.getTax().add(committed.getNetSalary()));
    }

    @Test
    void previewSurfacesDuplicatePeriodAsAWarningInsteadOfSilence() {
        PayrollRecord stale = new PayrollRecord();
        stale.setEmployeeId("e1");
        when(repository.findByTenantIdAndEmployeeIdAndPeriod("t1", "e1", "2026-01")).thenReturn(List.of(stale));

        PayrollPreview preview = service.previewPayroll(
                "t1", "e1", "2026-01",
                new BigDecimal("4000.00"), new BigDecimal("1000.00"), new BigDecimal("0.00"));

        assertTrue(preview.warnings().contains("Payroll already processed for this period"));
        // A dry run must never block on this: it writes nothing either way.
        verify(repository, org.mockito.Mockito.never()).saveAndFlush(any(PayrollRecord.class));
    }

    @Test
    void previewSurfacesZeroComponentsInsteadOfSilentZeros() {
        noStalePeriodRecords();

        PayrollPreview preview = service.previewPayroll(
                "t1", "e1", "2026-01",
                new BigDecimal("5000.00"), new BigDecimal("0.00"), new BigDecimal("0.00"));

        assertTrue(preview.warnings().stream().anyMatch(w -> w.contains("deductions is zero")));
        assertTrue(preview.warnings().stream().anyMatch(w -> w.contains("allowances is zero")));
    }
}
