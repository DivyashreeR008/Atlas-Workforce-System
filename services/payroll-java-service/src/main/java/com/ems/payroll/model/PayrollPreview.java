package com.ems.payroll.model;

import java.math.BigDecimal;
import java.util.List;

/**
 * Per-employee payroll breakdown produced by the shared computation path.
 * Both the preview (dry-run, zero writes) and the committed record come from
 * the same numbers, so a preview can never drift from what a commit would
 * write. status is PREVIEW for dry-run output and must never be confused
 * with a persisted PROCESSED record.
 */
public record PayrollPreview(
        String tenantId,
        String employeeId,
        String period,
        BigDecimal baseSalary,
        BigDecimal allowances,
        BigDecimal deductions,
        BigDecimal grossSalary,
        BigDecimal tax,
        BigDecimal socialSecurity,
        BigDecimal medicare,
        BigDecimal netSalary,
        String currency,
        String country,
        String status,
        List<String> warnings) {

    public static final String PREVIEW_STATUS = "PREVIEW";

    public static PayrollPreview of(String tenantId, String employeeId, String period,
                                    BigDecimal baseSalary, BigDecimal allowances, BigDecimal deductions,
                                    BigDecimal grossSalary, BigDecimal tax,
                                    BigDecimal socialSecurity, BigDecimal medicare,
                                    BigDecimal netSalary, String currency, String country,
                                    List<String> warnings) {
        return new PayrollPreview(tenantId, employeeId, period, baseSalary, allowances, deductions,
                grossSalary, tax, socialSecurity, medicare, netSalary, currency, country,
                PREVIEW_STATUS, warnings);
    }
}
