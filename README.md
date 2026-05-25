# Atlas Workforce System

A production‑grade, polyglot microservices platform for **workforce management, payroll processing, real‑time analytics, and live notifications** in a distributed environment.

---

## Overview

Atlas is a full‑stack HRMS platform built with 4 backend runtimes (Node.js, Python, Java, Go) and a modern Next.js frontend. Each domain workload routes to its optimal runtime—Go for high‑concurrency WebSocket broadcasting, Python for AI‑powered analytics, Java for transactional payroll, and Node.js for API orchestration.

**Live demo:** `http://localhost:3000` — Login: `admin@atlas.io` / `ChangeMe123!`

---

## System Architecture

```
                                    Frontend (Next.js 16 / Tailwind)
                                            │
                                       API Gateway (Node.js / Express)
      ┌──────────┬──────────┬──────────┬────┼────┬──────────┬──────────┬──────────┐
      │          │          │          │         │          │          │          │
   Auth     Employee   Payroll  Attendance   Leave   Analytics  Notific.  AI Copilot
  (Node/Ex) (Py/Fast) (Java/SB) (Go/Fiber)  (Java)  (Py/Fast)  (Go/WS)  (Py/Fast)
      │          │          │          │         │          │          │
   Audit &   ATS        LMS       Perform   Postgres  MongoDB   RabbitMQ
  Compl.   (Py/Fast) (Go/Fiber) (Java/SB)
  (Py/Fast)
      └──────────────────────────┼─────────────────────────────┘
                            Redis Cache
```

### Services

| Service | Language | Framework | Database | Port | Purpose |
|---------|----------|-----------|----------|:----:|---------|
| **API Gateway** | Node.js | Express | Redis | 8080 | Central routing, JWT auth, RBAC, rate limiting, WebSocket proxy, audit proxy |
| **Auth Service** | Node.js | Express | PostgreSQL | 8010 | User registration, login, JWT + refresh tokens, MFA (TOTP), device trust, SCIM 2.0, SAML SSO, passwordless login, session management |
| **Employee Service** | Python | FastAPI | MongoDB | 8001 | Employee CRUD, directory search, multi‑tenant |
| **Payroll Service** | Java | Spring Boot | PostgreSQL | 8002 | Salary calc, progressive tax, payroll runs |
| **Leave Service** | Java | Spring Boot | PostgreSQL | 8006 | Leave requests, approval workflow |
| **Attendance Service** | Go | Fiber | PostgreSQL | 8005 | Clock in/out, overtime calc, live status |
| **Analytics Service** | Python | FastAPI | PostgreSQL | 8003 | Dept headcount, payroll trends, AI insights |
| **Notification Service** | Go | net/http | In‑memory | 8004 | WebSocket broadcasting, REST API, RabbitMQ consumer |
| **Audit & Compliance** | Python | FastAPI | PostgreSQL | 8011 | Immutable audit log (SHA-256 hash chain), compliance policies, violation detection, GDPR portal, SOC2/ISO27001 readiness reports |
| **ATS** | Python | FastAPI | PostgreSQL | 8012 | Job postings, candidate tracking, application pipeline, interview scheduling, offer management, hiring analytics |
| **LMS** | Go | Fiber | PostgreSQL | 8013 | Course management, enrollments, certifications, assessments & auto-grading, learning paths, skill matrix with gap analysis |
| **Performance** | Java | Spring Boot | PostgreSQL | 8014 | OKR/goal tracking, performance reviews, 360° feedback, succession planning, peer recognitions |
| **AI Copilot** | Python | FastAPI | in‑memory | 8015 | AI chat assistant, attrition risk prediction, workforce forecasting, resume scoring & parsing, sentiment analysis, strategic insights |

---

## Tech Stack

### Frontend
- **Next.js 16** — App Router, React 19, SSR/SSG
- **Tailwind CSS 4** — Utility‑first styling with dark mode
- **TanStack Query** — Server state management
- **Zustand** — Client state (auth, toasts)
- **Recharts** — Charts and data visualization
- **Framer Motion** — Animations
- **SheetJS** — Excel (.xlsx) export
- **Radix UI** — Accessible primitives (dialog, dropdown, toast, etc.)

### Infrastructure
- **Docker / docker compose** — Local orchestration (13 containers)
- **RabbitMQ** — Event‑driven messaging
- **Prometheus + Grafana** — Monitoring stack
- **Kubernetes** — Production manifests (k8s/)

---

## ✨ Key Features

### Workforce Management
- **Employee Directory** — Searchable, paginated, multi‑tenant
- **Attendance Tracking** — Clock in/out with automatic overtime calculation
- **Leave Management** — Request, approve/reject workflow
- **Payroll Engine** — Salary computation, progressive tax, payslip history

### Real‑Time Capabilities
- **WebSocket Broadcasting** — Live notifications pushed to all connected clients
- **Notification Bell** — Unread badge, dropdown preview, auto‑reconnect
- **Live Attendance** — Real‑time check‑in feed on dashboard

### Analytics & AI
- **Department Headcount** — Live breakdown from employee service
- **Payroll Trends** — Aggregated payroll by period
- **Performance Predictions** — Mock ML scoring model
- **AI‑Powered Insights** — OpenAI integration for strategic HR analysis

### Data Export
- **CSV Export** — One‑click download on all data tables
- **Excel Export** — `.xlsx` with auto‑sized columns
- **JSON Export** — Raw data export on reports page

### Security (Zero-Trust)
- **JWT Authentication** — Access + refresh token rotation
- **MFA (TOTP)** — Time-based one-time passwords with backup codes
- **Device Trust** — Fingerprint-based device registration and verification
- **SCIM 2.0** — Automated user provisioning across identity providers (RFC 7643)
- **SAML SSO** — Single sign-on with SAML 2.0 assertion consumer
- **Passwordless Login** — Magic link authentication
- **Session Management** — Active session listing and remote revocation
- **RBAC** — Role‑based access control (admin, hr, manager, employee, recruiter, auditor)
- **Account Lockout** — Rate-limited login with failed attempt tracking
- **Per-User Rate Limiting** — Action-level rate limits with headers
- **MFA Step-Up** — Re-authentication required for sensitive operations
- **Helmet** — HTTP security headers on all Node.js services

### Talent Acquisition (ATS)
- **Job Postings** — Full lifecycle (draft → publish → close → filled)
- **Candidate Tracking** — Pipeline management with status transitions
- **Application Workflow** — Apply → Screen → Interview → Offer → Hire
- **Interview Scheduling** — Multi-round with feedback and ratings
- **Offer Management** — Salary, equity, benefits with accept/decline
- **Hiring Analytics** — Conversion funnel, time-to-hire, source effectiveness

### Learning & Development (LMS)
- **Course Management** — Catalog with categories, levels, and mandatory flags
- **Enrollments** — Self-enroll and bulk enrollment with progress tracking
- **Certifications** — External cert tracking with expiry alerts
- **Assessments** — Auto-graded quizzes with attempts and scoring
- **Learning Paths** — Curated course sequences for role development
- **Skill Matrix** — Org-wide skill inventory with gap analysis

### Performance Management
- **OKR/Goal Tracking** — Key results with progress bars for individuals and teams
- **Performance Reviews** — Multi-cycle (quarterly/annual) with rating scales
- **360° Feedback** — Peer, manager, subordinate, and self reviews
- **Succession Planning** — Readiness assessment and candidate ranking
- **Peer Recognition** — Badge-based appreciation with points

### AI & Intelligence
- **AI Copilot Chat** — Conversational assistant for HR and workforce questions
- **Attrition Prediction** — ML-based risk scoring with top contributing factors
- **Workforce Forecasting** — Hiring demand and skill gap projections
- **Resume Screening** — Automated scoring and parsing against job requirements
- **Sentiment Analysis** — Employee survey and feedback sentiment detection
- **Strategic Insights** — AI-generated organizational health recommendations

### Compliance & Audit
- **Immutable Audit Log** — SHA-256 hash chain (append-only, tamper-evident)
- **Compliance Policies** — Configurable rules for SOC2, GDPR, ISO27001
- **Violation Detection** — Automated scanning against policy rules
- **GDPR Portal** — Consent management, right to be forgotten, data portability
- **Readiness Reports** — Generated SOC2/GDPR/ISO27001 compliance reports

### Executive Command Center
- **Org Health Score** — Composite metric across retention, performance, engagement, diversity
- **Real-Time Activity Feed** — Live workforce events and changes
- **Department Performance Heatmap** — Cross-department comparison
- **Attrition Risk Alerts** — Proactive notifications for at-risk employees
- **AI Recommendations** — Auto-generated strategic action items

### DevOps
- **CI/CD** — GitHub Actions for all 5 runtimes
- **Docker** — Multi‑stage builds for slim production images
- **Kubernetes** — Ready‑to‑deploy manifests with 14 services
- **Monitoring** — Prometheus metrics + Grafana dashboards
- **k6 Performance Tests** — Smoke, stress, and spike testing
- **Chaos Engineering** — Service failure and network delay injection scripts

---

## API Endpoints

### Auth Service (`:8010`)
- `POST /register` — Create account
- `POST /login` — Sign in (returns JWT + refresh token)
- `POST /refresh` — Rotate tokens
- `POST /logout` — Revoke refresh token

### Employee Service (`:8001`)
- `GET /employees` — Paginated list with search
- `GET /employees/{email}` — Get by email
- `POST /employees` — Create employee
- `PUT /employees/{email}` — Update employee
- `DELETE /employees/{email}` — Delete employee

### Payroll Service (`:8002`)
- `GET /api/payroll` — All payroll records
- `GET /api/payroll/employee/{employeeId}` — By employee
- `POST /api/payroll/run` — Process payroll (admin only)

### Analytics Service (`:8003`)
- `GET /analytics/department` — Headcount breakdown
- `GET /analytics/payroll` — Payroll trends
- `GET /analytics/performance` — Performance prediction
- `POST /analytics/ai-insights` — AI‑powered strategic insights

### Notification Service (`:8004`)
- `GET /api/notifications` — List notifications
- `POST /api/notifications` — Mark as read
- `WS /ws` — WebSocket for live events

### Attendance Service (`:8005`)
- `GET /api/attendance` — All records
- `GET /api/attendance/employee/{employeeId}` — By employee
- `POST /api/attendance/clock-in` — Clock in
- `POST /api/attendance/clock-out` — Clock out

### Leave Service (`:8006`)
- `GET /api/leave` — All requests
- `GET /api/leave/employee/{employeeId}` — By employee
- `POST /api/leave/request` — Submit request
- `PUT /api/leave/{id}/status` — Approve/reject (admin only)

### Audit & Compliance (`:8011`)
- `GET /api/v1/audit/logs` — List audit logs (paginated, filterable)
- `POST /api/v1/audit/log` — Create audit entry (internal)
- `GET /api/v1/audit/verify-chain` — Verify audit hash chain integrity
- `GET /api/v1/compliance/policies` — List compliance policies
- `POST /api/v1/compliance/policies` — Create policy
- `GET /api/v1/compliance/violations` — List violations
- `POST /api/v1/compliance/scan` — Trigger compliance scan
- `GET /api/v1/compliance/reports/{type}` — SOC2/GDPR/ISO27001 readiness report
- `GET /api/v1/gdpr/consents/{employee_id}` — Get consent records
- `POST /api/v1/gdpr/forget/{employee_id}` — Right to be forgotten
- `GET /api/v1/gdpr/data-portability/{employee_id}` — Export employee data

### ATS (`:8012`)
- `GET /api/v1/jobs` — List job postings (paginated, filterable)
- `POST /api/v1/jobs` — Create job
- `POST /api/v1/jobs/{id}/publish` — Publish job
- `GET /api/v1/candidates` — List candidates (paginated)
- `POST /api/v1/candidates` — Create candidate
- `GET /api/v1/applications` — List applications
- `POST /api/v1/applications` — Submit application
- `PUT /api/v1/applications/{id}/status` — Update application status
- `POST /api/v1/interviews` — Schedule interview
- `PUT /api/v1/interviews/{id}/feedback` — Submit interview feedback
- `POST /api/v1/offers` — Create offer
- `POST /api/v1/offers/{id}/send` — Send offer to candidate
- `GET /api/v1/analytics/conversion-funnel` — Hiring pipeline analytics

### LMS (`:8013`)
- `GET /api/v1/courses` — List courses (filterable by category, level)
- `POST /api/v1/courses` — Create course
- `POST /api/v1/enrollments` — Enroll employee
- `PUT /api/v1/enrollments/{id}/progress` — Update course progress
- `PUT /api/v1/enrollments/{id}/complete` — Complete course (generates certificate)
- `GET /api/v1/certifications` — List certifications
- `POST /api/v1/assessments` — Create assessment
- `POST /api/v1/assessments/{id}/attempt` — Start assessment attempt
- `PUT /api/v1/assessments/{id}/attempt` — Submit and auto-grade
- `GET /api/v1/skills/gap-analysis` — Analyze skill gaps
- `GET /api/v1/skills/matrix` — Org-wide skill matrix

### Performance (`:8014`)
- `GET /api/v1/goals` — List goals/OKRs
- `POST /api/v1/goals` — Create goal
- `PUT /api/v1/goals/{id}/progress` — Update key result progress
- `GET /api/v1/reviews` — List performance reviews
- `POST /api/v1/reviews` — Create review cycle
- `PUT /api/v1/reviews/{id}/submit` — Submit completed review
- `POST /api/v1/feedback` — Submit 360° feedback
- `GET /api/v1/succession/plans` — List succession plans
- `POST /api/v1/succession/candidates` — Add candidate to plan
- `POST /api/v1/recognitions` — Give peer recognition
- `GET /api/v1/analytics/department-ratings` — Department performance averages

### AI Copilot (`:8015`)
- `POST /api/v1/copilot/chat` — Chat with AI assistant
- `POST /api/v1/predict/attrition-risk` — Predict employee attrition
- `POST /api/v1/predict/performance` — Forecast performance scores
- `POST /api/v1/forecast/hiring-demand` — Predict hiring needs
- `POST /api/v1/forecast/skill-gap` — Analyze skill gaps
- `POST /api/v1/resume/score` — Score resume against job description
- `POST /api/v1/sentiment/analyze` — Analyze text sentiment

### Auth Security (`:8010`)
- `POST /mfa/setup` — Generate TOTP secret and backup codes
- `POST /mfa/verify` — Verify TOTP during setup
- `POST /mfa/validate` — Validate TOTP during login
- `GET /sessions` — List active sessions
- `DELETE /sessions/{id}` — Revoke session
- `GET /scim/v2/Users` — SCIM list users
- `POST /scim/v2/Users` — SCIM create user
- `POST /saml/acs` — SAML assertion consumer
- `POST /auth/passwordless/request` — Request magic link

---

## Getting Started

### Prerequisites
- **Docker** + **docker compose**
- **Git**

### Run the Project

```bash
git clone https://github.com/Senthil455/Atlas-Workforce-System.git
cd Atlas-Workforce-System
docker compose up --build
```

This starts **18 containers**: postgres, mongodb, redis, rabbitmq + 14 application services.

### Access

| Service | URL |
|---------|-----|
| Frontend | `http://localhost:3000` |
| API Gateway | `http://localhost:8080` |
| Auth Service | `http://localhost:8010/docs` |
| Analytics Service | `http://localhost:8003/docs` |
| Audit & Compliance | `http://localhost:8011/docs` |
| ATS | `http://localhost:8012/docs` |
| AI Copilot | `http://localhost:8015/docs` |
| RabbitMQ UI | `http://localhost:15672` (guest/guest) |
| Grafana | `http://localhost:3001` (admin/admin) |
| Prometheus | `http://localhost:9090` |

### Default Credentials

- **Admin:** `admin@atlas.io` / `ChangeMe123!`

---

## Development

### Project Structure

```
Atlas-Workforce-System/
├── frontend/                            # Next.js application (port 3000)
├── services/
│   ├── api-gateway-node/                # Node.js API Gateway (8080)
│   ├── auth-service/                    # Node.js Auth (8010) — MFA, SCIM, SAML, sessions
│   ├── employee-python-service/         # Python FastAPI Employee (8001)
│   ├── payroll-java-service/            # Java Spring Boot Payroll (8002)
│   ├── analytics-python-service/        # Python FastAPI Analytics (8003)
│   ├── notification-go-service/         # Go WebSocket + REST Notifications (8004)
│   ├── attendance-service/              # Go Fiber Attendance (8005)
│   ├── leave-service/                   # Java Spring Boot Leave (8006)
│   ├── audit-compliance-service/        # Python Immutable Audit + Compliance (8011)
│   ├── ats-service/                     # Python Applicant Tracking System (8012)
│   ├── lms-service/                     # Go Learning Management System (8013)
│   ├── performance-service/             # Java OKR/Reviews/Succession (8014)
│   ├── ai-copilot-service/              # Python AI Copilot + Predictions (8015)
│   └── integration-service/             # Python (future)
├── tests/                               # Integration, performance, chaos tests
│   ├── performance/                     # k6 smoke/stress/spike
│   ├── chaos/                           # Service failure + network delay scripts
│   └── integration/                     # End-to-end workflow tests
├── docs/                                # Architecture docs
├── k8s/                                 # Kubernetes manifests (14 services)
├── .github/workflows/                   # CI pipeline (5 matrix jobs)
├── docker-compose.yml                   # Main orchestration (18 containers)
├── docker-compose.monitoring.yml        # Prometheus + Grafana
├── Makefile                             # Dev CLI commands
└── prometheus.yml                       # Metrics config (14 targets)
```

### Available Commands

```bash
make up          # Start all services
make down        # Stop all services
make logs        # Tail container logs
make test        # Run all unit tests
make build-all   # Force rebuild images
```

---

## Testing

Each service has unit tests:

```bash
# Node.js services
cd services/auth-service && npm test
cd services/api-gateway-node && npm test

# Python services
cd services/employee-python-service && python -m pytest -v
cd services/analytics-python-service && python -m pytest -v

# Java services
cd services/payroll-java-service && mvn test
cd services/leave-service && mvn test

# E2E (Playwright)
cd frontend && npx playwright test

# Or all at once
make test
```

---

## Monitoring

```bash
docker compose -f docker-compose.monitoring.yml up -d
```

- **Prometheus** — `http://localhost:9090`
- **Grafana** — `http://localhost:3001` (admin/admin)

---

## Future Roadmap

### Phase 1 — Quick Wins (completed)
- [x] Standardized UI components with dark mode
- [x] Redis caching for employee directory
- [x] CSV, Excel, and JSON export on all data tables
- [x] Real‑time WebSocket notifications
- [x] OpenAPI/Swagger docs on Python services
- [x] Live attendance widget on dashboard

### Phase 2 — Medium Impact
- [ ] Centralized RBAC management panel
- [ ] Multi‑tenant database isolation
- [ ] Automated PDF payslip generation
- [ ] Bulk approve/reject for leave
- [ ] Email notification integration (SMTP)

### Phase 3 — Enterprise
- [ ] Applicant Tracking System (ATS)
- [ ] Biometric / geofenced attendance
- [ ] Advanced reporting with customizable dashboards
- [ ] SOC2 compliance audit logs

### Phase 4 — AI‑Powered
- [ ] Predictive attrition ML models
- [ ] NLP HR assistant chatbot
- [ ] AI‑driven shift optimization
- [ ] Resume screening and scoring

---

## Author

**Senthil Raja R**  
Full Stack Developer | AI Automation Enthusiast

- Email: [senthilrajasen637@gmail.com](mailto:senthilrajasen637@gmail.com)
- LinkedIn: [senthil-raja-r](https://www.linkedin.com/in/senthil-raja-r-a29839329/)

---

## License

MIT
