CREATE TABLE IF NOT EXISTS leave_records (
    id BIGSERIAL PRIMARY KEY,
    version BIGINT NOT NULL DEFAULT 0,
    employee_id VARCHAR(255) NOT NULL,
    tenant_id VARCHAR(255) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    leave_type VARCHAR(255) NOT NULL,
    reason VARCHAR(255),
    status VARCHAR(20) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_leave_employee ON leave_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_status ON leave_records(status);
