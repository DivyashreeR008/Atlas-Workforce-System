-- Atomic duplicate-payroll guard.
--
-- The check-then-save guard in PayrollService and PayrollEnterpriseService is
-- only advisory: two concurrent runs for the same employee and period both
-- pass it. These unique indexes are the real guard; both services map their
-- violation back to the existing friendly "Payroll already processed for this
-- period" error.
--
-- If a database already contains duplicates from the old race, index creation
-- fails with the offending key values. Nothing is deleted here on purpose:
-- payroll rows are not silently discarded by a schema migration. Resolve the
-- reported duplicates (the anomaly scan already flags them as
-- duplicate_payroll findings) before applying this migration.

CREATE UNIQUE INDEX IF NOT EXISTS ux_payroll_records_tenant_employee_period
    ON payroll_records (tenant_id, employee_id, period);

CREATE UNIQUE INDEX IF NOT EXISTS ux_enhanced_payroll_records_tenant_employee_period
    ON enhanced_payroll_records (tenant_id, employee_id, period);
