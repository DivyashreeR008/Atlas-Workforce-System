package com.ems.payroll.util;

/**
 * Duplicate-payroll detection helpers shared by the two payroll entry points.
 *
 * <p>The pre-check in each service ("Payroll already processed for this
 * period") is only advisory: two concurrent runs can both pass it. The real
 * guard is the unique index on (tenant_id, employee_id, period), and the
 * service that loses the race catches the resulting constraint violation and
 * maps it back to the same friendly error.
 */
public final class PayrollDuplicates {

    /** Unique index on payroll_records defined in V4__payroll_period_unique.sql. */
    public static final String PAYROLL_RECORDS_PERIOD = "ux_payroll_records_tenant_employee_period";

    /** Unique index on enhanced_payroll_records defined in V4__payroll_period_unique.sql. */
    public static final String ENHANCED_PAYROLL_RECORDS_PERIOD = "ux_enhanced_payroll_records_tenant_employee_period";

    private PayrollDuplicates() {
    }

    /**
     * True when any exception in the cause chain names the given constraint.
     * Spring Data wraps the database error in a
     * {@code DataIntegrityViolationException} whose cause chain carries the
     * SQL error message, which on PostgreSQL includes the constraint name.
     */
    public static boolean isUniqueConstraintViolation(Throwable error, String constraintName) {
        Throwable current = error;
        while (current != null) {
            String message = current.getMessage();
            if (message != null && message.contains(constraintName)) {
                return true;
            }
            if (current.getCause() == current) {
                return false;
            }
            current = current.getCause();
        }
        return false;
    }
}
