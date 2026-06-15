CREATE TABLE IF NOT EXISTS payroll_records (
    id BIGSERIAL PRIMARY KEY,
    employee_id VARCHAR(255) NOT NULL,
    tenant_id VARCHAR(255) NOT NULL,
    period VARCHAR(255) NOT NULL,
    base_salary DOUBLE PRECISION NOT NULL CHECK (base_salary >= 0),
    allowances DOUBLE PRECISION NOT NULL CHECK (allowances >= 0),
    deductions DOUBLE PRECISION NOT NULL CHECK (deductions >= 0),
    tax DOUBLE PRECISION NOT NULL CHECK (tax >= 0),
    net_salary DOUBLE PRECISION NOT NULL CHECK (net_salary >= 0),
    status VARCHAR(255),
    processed_date TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_payroll_employee ON payroll_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_period ON payroll_records(period);

CREATE TABLE IF NOT EXISTS enhanced_payroll_records (
    id BIGSERIAL PRIMARY KEY,
    employee_id VARCHAR(255),
    tenant_id VARCHAR(255),
    period VARCHAR(255),
    country VARCHAR(255),
    currency VARCHAR(255),
    base_salary DOUBLE PRECISION CHECK (base_salary >= 0),
    allowances DOUBLE PRECISION CHECK (allowances >= 0),
    deductions DOUBLE PRECISION CHECK (deductions >= 0),
    tax DOUBLE PRECISION CHECK (tax >= 0),
    social_security DOUBLE PRECISION CHECK (social_security >= 0),
    medicare DOUBLE PRECISION CHECK (medicare >= 0),
    net_salary DOUBLE PRECISION CHECK (net_salary >= 0),
    gross_salary DOUBLE PRECISION CHECK (gross_salary >= 0),
    payment_method VARCHAR(255),
    bank_account VARCHAR(255),
    bank_routing VARCHAR(255),
    status VARCHAR(255),
    processed_date TIMESTAMP,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_epr_employee ON enhanced_payroll_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_epr_period ON enhanced_payroll_records(period);

CREATE TABLE IF NOT EXISTS payslips (
    id BIGSERIAL PRIMARY KEY,
    payroll_id BIGINT,
    employee_id VARCHAR(255),
    tenant_id VARCHAR(255),
    period VARCHAR(255),
    pdf_content TEXT,
    pdf_url VARCHAR(255),
    generated_at TIMESTAMP,
    created_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bonuses (
    id BIGSERIAL PRIMARY KEY,
    employee_id VARCHAR(255),
    tenant_id VARCHAR(255),
    amount DOUBLE PRECISION CHECK (amount >= 0),
    type VARCHAR(255),
    reason VARCHAR(255),
    award_date DATE,
    payout_date DATE,
    currency VARCHAR(255),
    status VARCHAR(255),
    approved_by VARCHAR(255),
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS compensation_plans (
    id BIGSERIAL PRIMARY KEY,
    employee_id VARCHAR(255),
    tenant_id VARCHAR(255),
    current_base_salary DOUBLE PRECISION CHECK (current_base_salary >= 0),
    proposed_base_salary DOUBLE PRECISION CHECK (proposed_base_salary >= 0),
    currency VARCHAR(255),
    effective_date DATE,
    reason VARCHAR(255),
    status VARCHAR(255),
    approved_by VARCHAR(255),
    review_cycle VARCHAR(255),
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS equity_grants (
    id BIGSERIAL PRIMARY KEY,
    employee_id VARCHAR(255),
    tenant_id VARCHAR(255),
    shares DOUBLE PRECISION,
    strike_price DOUBLE PRECISION,
    fair_market_value DOUBLE PRECISION,
    grant_date DATE,
    vesting_start DATE,
    vesting_end DATE,
    vesting_schedule VARCHAR(255),
    equity_type VARCHAR(255),
    status VARCHAR(255),
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS benefit_plans (
    id BIGSERIAL PRIMARY KEY,
    tenant_id VARCHAR(255),
    name VARCHAR(255),
    type VARCHAR(255),
    description VARCHAR(255),
    employer_contribution DOUBLE PRECISION,
    employee_contribution DOUBLE PRECISION,
    max_benefit_amount DOUBLE PRECISION,
    max_participants INT,
    current_participants INT,
    is_active BOOLEAN,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    version INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS benefit_enrollments (
    id BIGSERIAL PRIMARY KEY,
    employee_id VARCHAR(255),
    tenant_id VARCHAR(255),
    plan_id BIGINT,
    enrollment_date DATE,
    effective_date DATE,
    termination_date DATE,
    status VARCHAR(255),
    employee_contribution DOUBLE PRECISION,
    employer_contribution DOUBLE PRECISION,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bank_transactions (
    id BIGSERIAL PRIMARY KEY,
    employee_id VARCHAR(255),
    tenant_id VARCHAR(255),
    payroll_id BIGINT,
    amount DOUBLE PRECISION,
    account_number VARCHAR(255),
    routing_number VARCHAR(255),
    bank_name VARCHAR(255),
    account_type VARCHAR(255),
    transaction_type VARCHAR(255),
    reference VARCHAR(255),
    status VARCHAR(255),
    processed_at TIMESTAMP,
    created_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tax_brackets (
    id BIGSERIAL PRIMARY KEY,
    tenant_id VARCHAR(255),
    country VARCHAR(255),
    tax_year VARCHAR(255),
    min_income DOUBLE PRECISION,
    max_income DOUBLE PRECISION,
    rate DOUBLE PRECISION,
    flat_amount DOUBLE PRECISION,
    bracket_order INT
);

CREATE TABLE IF NOT EXISTS payroll_compliance_reports (
    id BIGSERIAL PRIMARY KEY,
    tenant_id VARCHAR(255),
    report_type VARCHAR(255),
    period VARCHAR(255),
    country VARCHAR(255),
    summary TEXT,
    details TEXT,
    status VARCHAR(255),
    generated_by VARCHAR(255),
    generated_at TIMESTAMP,
    created_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payroll_forecasts (
    id BIGSERIAL PRIMARY KEY,
    tenant_id VARCHAR(255),
    period VARCHAR(255),
    projected_gross_payroll DOUBLE PRECISION,
    projected_net_payroll DOUBLE PRECISION,
    projected_tax DOUBLE PRECISION,
    projected_benefits DOUBLE PRECISION,
    confidence DOUBLE PRECISION,
    factors TEXT,
    status VARCHAR(255),
    generated_at TIMESTAMP,
    created_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payroll_anomalies (
    id BIGSERIAL PRIMARY KEY,
    tenant_id VARCHAR(255),
    payroll_id BIGINT,
    employee_id VARCHAR(255),
    anomaly_type VARCHAR(255),
    severity VARCHAR(255),
    description TEXT,
    is_resolved BOOLEAN,
    detected_at TIMESTAMP,
    resolved_at TIMESTAMP,
    created_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payroll_audits (
    id BIGSERIAL PRIMARY KEY,
    payroll_id BIGINT,
    tenant_id VARCHAR(255),
    action VARCHAR(255),
    changed_by VARCHAR(255),
    field_name VARCHAR(255),
    old_value TEXT,
    new_value TEXT,
    changed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS expense_reports (
    id BIGSERIAL PRIMARY KEY,
    employee_id VARCHAR(255),
    tenant_id VARCHAR(255),
    category VARCHAR(255),
    amount DOUBLE PRECISION CHECK (amount >= 0),
    description TEXT,
    receipt_url VARCHAR(255),
    expense_date DATE,
    status VARCHAR(255),
    approved_by VARCHAR(255),
    rejected_reason VARCHAR(255),
    submitted_at TIMESTAMP,
    processed_at TIMESTAMP,
    created_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS outbox_events (
    id BIGSERIAL PRIMARY KEY,
    aggregate_type VARCHAR(255) NOT NULL,
    aggregate_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(255) NOT NULL,
    payload TEXT,
    status VARCHAR(255) NOT NULL,
    retry_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL,
    processed_at TIMESTAMP,
    trace_id VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS salary_benchmarks (
    id BIGSERIAL PRIMARY KEY,
    tenant_id VARCHAR(255),
    role VARCHAR(255),
    experience VARCHAR(255),
    location VARCHAR(255),
    industry VARCHAR(255),
    percentile10 DOUBLE PRECISION CHECK (percentile10 >= 0),
    percentile25 DOUBLE PRECISION CHECK (percentile25 >= 0),
    percentile50 DOUBLE PRECISION CHECK (percentile50 >= 0),
    percentile75 DOUBLE PRECISION CHECK (percentile75 >= 0),
    percentile90 DOUBLE PRECISION CHECK (percentile90 >= 0),
    currency VARCHAR(255),
    source VARCHAR(255),
    year VARCHAR(255),
    created_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS country_tax_configs (
    id BIGSERIAL PRIMARY KEY,
    tenant_id VARCHAR(255),
    country VARCHAR(255),
    currency VARCHAR(255),
    tax_year VARCHAR(255),
    standard_deduction DOUBLE PRECISION,
    social_security_rate DOUBLE PRECISION,
    medicare_rate DOUBLE PRECISION,
    corporate_tax_rate DOUBLE PRECISION,
    has_progressive_tax BOOLEAN,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
