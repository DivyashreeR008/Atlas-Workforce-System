package com.ems.payroll;

import com.ems.payroll.model.OutboxEvent;
import com.ems.payroll.model.PayrollPreview;
import com.ems.payroll.repository.OutboxEventRepository;
import com.ems.payroll.service.PayrollFailureOutboxWriter;
import com.ems.payroll.util.Money;
import com.ems.payroll.util.PayrollDuplicates;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
public class PayrollService {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final PayrollRepository repository;
    private final OutboxEventRepository outboxEventRepository;
    private final PayrollFailureOutboxWriter failureOutbox;

    // Simple progressive tax bands used when no country tax configuration
    // exists. The defaults mirror the values that used to be literals; income
    // up to lower-limit is untaxed, then each band applies its rate up to the
    // next limit, and high-rate applies to everything above upper-limit.
    @Value("${payroll.simple-tax.lower-limit:3000.00}")
    private BigDecimal simpleTaxLowerLimit = new BigDecimal("3000.00");

    @Value("${payroll.simple-tax.middle-limit:7000.00}")
    private BigDecimal simpleTaxMiddleLimit = new BigDecimal("7000.00");

    @Value("${payroll.simple-tax.upper-limit:12000.00}")
    private BigDecimal simpleTaxUpperLimit = new BigDecimal("12000.00");

    @Value("${payroll.simple-tax.low-rate:0.15}")
    private double simpleTaxLowRate = 0.15;

    @Value("${payroll.simple-tax.middle-rate:0.25}")
    private double simpleTaxMiddleRate = 0.25;

    @Value("${payroll.simple-tax.high-rate:0.35}")
    private double simpleTaxHighRate = 0.35;

    public PayrollService(PayrollRepository repository, OutboxEventRepository outboxEventRepository,
                          PayrollFailureOutboxWriter failureOutbox) {
        this.repository = repository;
        this.outboxEventRepository = outboxEventRepository;
        this.failureOutbox = failureOutbox;
    }

    public List<PayrollRecord> getAllPayrolls(String tenantId) {
        return repository.findByTenantId(tenantId);
    }

    public List<PayrollRecord> getPayrollsByEmployeeId(String tenantId, String employeeId) {
        return repository.findByTenantIdAndEmployeeId(tenantId, employeeId);
    }

    @Transactional
    public PayrollRecord runPayroll(String tenantId, String employeeId, String period, BigDecimal baseSalary, BigDecimal allowances, BigDecimal deductions) {
        try {
            // Check if payroll already exists for this period
            List<PayrollRecord> existing = repository.findByTenantIdAndEmployeeIdAndPeriod(tenantId, employeeId, period);
            if (!existing.isEmpty()) {
                throw new IllegalArgumentException("Payroll already processed for this period");
            }

            // Computation is shared with the dry-run preview below so a
            // preview can never drift from what a commit writes.
            PayrollPreview computed = computeBreakdown(tenantId, employeeId, period, baseSalary, allowances, deductions);

            PayrollRecord record = new PayrollRecord();
            record.setTenantId(tenantId);
            record.setEmployeeId(employeeId);
            record.setPeriod(period);
            record.setBaseSalary(computed.baseSalary());
            record.setAllowances(computed.allowances());
            record.setDeductions(computed.deductions());
            record.setTax(computed.tax());
            record.setNetSalary(computed.netSalary());
            record.setStatus("PROCESSED");
            record.setProcessedDate(LocalDateTime.now());

            record = saveOrRejectDuplicate(record);

            OutboxEvent outboxEvent = new OutboxEvent();
            outboxEvent.setAggregateType("payroll");
            outboxEvent.setAggregateId(String.valueOf(record.getId()));
            outboxEvent.setEventType("PAYROLL_PROCESSED");
            outboxEvent.setPayload(toJson(Map.of(
                "payrollId", record.getId(),
                "employeeId", employeeId,
                "period", period,
                "grossAmount", computed.grossSalary(),
                "netAmount", computed.netSalary(),
                "currency", "USD",
                "status", "PROCESSED",
                "timestamp", LocalDateTime.now().toString(),
                "tenantId", tenantId
            )));
            outboxEvent.setStatus("PENDING");
            outboxEvent.setRetryCount(0);
            outboxEvent.setCreatedAt(LocalDateTime.now());
            outboxEventRepository.save(outboxEvent);

            return record;
        } catch (Exception e) {
            // The failure event is committed in its own transaction: an outbox
            // row written here would roll back together with the failed run,
            // leaving exactly the runs that need an audit trail with none.
            failureOutbox.recordFailure(tenantId, employeeId, period, e.getMessage());
            throw e;
        }
    }

    /**
     * Dry-run: identical computation to runPayroll, zero writes. The payload
     * is explicitly labeled PREVIEW and carries warnings for the classes of
     * mistake a preview exists to catch (already-processed period, zero or
     * missing components).
     */
    public PayrollPreview previewPayroll(String tenantId, String employeeId, String period,
                                         BigDecimal baseSalary, BigDecimal allowances, BigDecimal deductions) {
        return computeBreakdown(tenantId, employeeId, period, Money.of(baseSalary),
                Money.of(allowances), Money.of(deductions));
    }

    /**
     * The one computation path for this service. runPayroll uses the returned
     * numbers verbatim when it persists, so commit-after-preview is a parity
     * guarantee by construction rather than a second formula to keep in sync.
     */
    PayrollPreview computeBreakdown(String tenantId, String employeeId, String period,
                                    BigDecimal baseSalary, BigDecimal allowances, BigDecimal deductions) {
        List<String> warnings = new ArrayList<>();
        List<PayrollRecord> existing = repository.findByTenantIdAndEmployeeIdAndPeriod(tenantId, employeeId, period);
        if (!existing.isEmpty()) {
            warnings.add("Payroll already processed for this period");
        }
        for (Object[] field : List.of(
                new Object[]{"baseSalary", baseSalary},
                new Object[]{"allowances", allowances},
                new Object[]{"deductions", deductions})) {
            BigDecimal value = (BigDecimal) field[1];
            if (Money.of(value).signum() == 0) {
                warnings.add(field[0] + " is zero; confirm this is intended and not a missing component");
            }
        }

        BigDecimal gross = Money.subtract(Money.add(Money.of(baseSalary), Money.of(allowances)), Money.of(deductions));
        BigDecimal tax = calculateTax(gross);
        BigDecimal net = Money.subtract(gross, tax);
        return PayrollPreview.of(tenantId, employeeId, period, Money.of(baseSalary), Money.of(allowances),
                Money.of(deductions), gross, tax, Money.zero(), Money.zero(), net, "USD", null, warnings);
    }

    /**
     * Saves and flushes so a unique-constraint violation surfaces here and can
     * be mapped to the friendly duplicate message. The pre-check in runPayroll
     * is only advisory; this is the loser of a concurrent double run.
     */
    private PayrollRecord saveOrRejectDuplicate(PayrollRecord record) {
        try {
            return repository.saveAndFlush(record);
        } catch (DataIntegrityViolationException e) {
            if (PayrollDuplicates.isUniqueConstraintViolation(e, PayrollDuplicates.PAYROLL_RECORDS_PERIOD)) {
                throw new IllegalArgumentException("Payroll already processed for this period", e);
            }
            throw e;
        }
    }

    public BigDecimal calculateTax(BigDecimal grossSalary) {
        // Simple progressive tax calculation, rounded to cents at each bracket.
        BigDecimal gross = Money.of(grossSalary);
        if (gross.compareTo(simpleTaxLowerLimit) <= 0) return Money.zero();
        if (gross.compareTo(simpleTaxMiddleLimit) <= 0) {
            return Money.percentOf(gross.subtract(simpleTaxLowerLimit), simpleTaxLowRate);
        }
        if (gross.compareTo(simpleTaxUpperLimit) <= 0) {
            return Money.add(
                    Money.percentOf(simpleTaxMiddleLimit.subtract(simpleTaxLowerLimit), simpleTaxLowRate),
                    Money.percentOf(gross.subtract(simpleTaxMiddleLimit), simpleTaxMiddleRate));
        }
        return Money.add(
                Money.add(
                        Money.percentOf(simpleTaxMiddleLimit.subtract(simpleTaxLowerLimit), simpleTaxLowRate),
                        Money.percentOf(simpleTaxUpperLimit.subtract(simpleTaxMiddleLimit), simpleTaxMiddleRate)),
                Money.percentOf(gross.subtract(simpleTaxUpperLimit), simpleTaxHighRate));
    }

    private static String toJson(Map<String, Object> payload) {
        try {
            return MAPPER.writeValueAsString(payload);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("Failed to serialize outbox payload", e);
        }
    }
}
