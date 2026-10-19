CREATE TABLE IF NOT EXISTS calendar_connections (
    id BIGSERIAL PRIMARY KEY,
    version BIGINT NOT NULL DEFAULT 0,
    tenant_id VARCHAR(255) NOT NULL,
    employee_id VARCHAR(255) NOT NULL,
    provider VARCHAR(50) NOT NULL,
    auth_ref VARCHAR(255),
    status VARCHAR(30) NOT NULL,
    sync_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    last_synced_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_conn_employee
    ON calendar_connections(tenant_id, employee_id, provider);

CREATE TABLE IF NOT EXISTS calendar_sync_states (
    id BIGSERIAL PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    leave_id BIGINT NOT NULL,
    employee_id VARCHAR(255) NOT NULL,
    provider VARCHAR(50) NOT NULL,
    idempotency_key VARCHAR(255) NOT NULL,
    external_event_id VARCHAR(255),
    status VARCHAR(30) NOT NULL,
    failure_reason VARCHAR(500),
    retry_count INT NOT NULL DEFAULT 0,
    last_attempt_at TIMESTAMP,
    updated_at TIMESTAMP,
    CONSTRAINT uq_state_leave_provider UNIQUE (leave_id, provider)
);
CREATE INDEX IF NOT EXISTS idx_state_tenant ON calendar_sync_states(tenant_id);
