CREATE TABLE IF NOT EXISTS performance_reviews (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL,
    employee_id VARCHAR(100) NOT NULL,
    reviewer_id VARCHAR(100),
    review_cycle VARCHAR(50),
    review_type VARCHAR(30),
    due_date DATE,
    completed_date TIMESTAMP,
    status VARCHAR(20) DEFAULT 'PENDING',
    overall_rating DECIMAL(2,1),
    strengths TEXT,
    areas_for_improvement TEXT,
    comments TEXT,
    scores jsonb,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_review_tenant ON performance_reviews(tenant_id);
CREATE INDEX IF NOT EXISTS idx_review_employee ON performance_reviews(employee_id);
CREATE INDEX IF NOT EXISTS idx_review_cycle ON performance_reviews(review_cycle);
CREATE INDEX IF NOT EXISTS idx_review_status ON performance_reviews(status);

CREATE TABLE IF NOT EXISTS feedback_360 (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL,
    employee_id VARCHAR(100) NOT NULL,
    reviewer_id VARCHAR(100) NOT NULL,
    review_id VARCHAR(36),
    relationship VARCHAR(30),
    rating DECIMAL(2,1),
    feedback_text TEXT NOT NULL,
    categories jsonb,
    is_confidential BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'SUBMITTED',
    created_at TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_feedback_tenant ON feedback_360(tenant_id);
CREATE INDEX IF NOT EXISTS idx_feedback_employee ON feedback_360(employee_id);
CREATE INDEX IF NOT EXISTS idx_feedback_reviewer ON feedback_360(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_feedback_review ON feedback_360(review_id);

CREATE TABLE IF NOT EXISTS goals (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL,
    employee_id VARCHAR(100) NOT NULL,
    title VARCHAR(300) NOT NULL,
    description TEXT,
    goal_type VARCHAR(20),
    category VARCHAR(30),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    progress_pct DECIMAL(5,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'DRAFT',
    key_results jsonb,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_goal_tenant ON goals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_goal_employee ON goals(employee_id);
CREATE INDEX IF NOT EXISTS idx_goal_status ON goals(status);

CREATE TABLE IF NOT EXISTS recognitions (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL,
    from_employee_id VARCHAR(100),
    to_employee_id VARCHAR(100) NOT NULL,
    category VARCHAR(30),
    message TEXT NOT NULL,
    badge VARCHAR(50),
    points INT DEFAULT 1,
    created_at TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_recognition_tenant ON recognitions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_recognition_to ON recognitions(to_employee_id);
CREATE INDEX IF NOT EXISTS idx_recognition_from ON recognitions(from_employee_id);

CREATE TABLE IF NOT EXISTS succession_plans (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL,
    position VARCHAR(200) NOT NULL,
    department VARCHAR(100),
    current_holder_id VARCHAR(100),
    readiness VARCHAR(30),
    risk_of_loss VARCHAR(20),
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_splan_tenant ON succession_plans(tenant_id);
CREATE INDEX IF NOT EXISTS idx_splan_position ON succession_plans(position);
CREATE INDEX IF NOT EXISTS idx_splan_department ON succession_plans(department);

CREATE TABLE IF NOT EXISTS succession_candidates (
    id VARCHAR(36) PRIMARY KEY,
    tenant_id VARCHAR(50) NOT NULL,
    plan_id VARCHAR(36) NOT NULL,
    employee_id VARCHAR(100) NOT NULL,
    readiness_score DECIMAL(5,2),
    ranking INT,
    development_plan TEXT,
    strengths TEXT,
    gaps TEXT,
    status VARCHAR(20) DEFAULT 'IDENTIFIED',
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_scandidate_tenant ON succession_candidates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_scandidate_plan ON succession_candidates(plan_id);
CREATE INDEX IF NOT EXISTS idx_scandidate_employee ON succession_candidates(employee_id);
