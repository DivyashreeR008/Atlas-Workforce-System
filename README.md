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
                    ┌──────────────┼──────────────┬──────────────┐
                    │              │              │              │
              Auth Service    Employee       Payroll        Attendance
             (Node.js/Express) Service       Service         Service
                              (Python/       (Java/          (Go/Fiber)
                              FastAPI)      Spring Boot)
                    │              │              │              │
              Leave Service   Analytics     Notification    Integration
              (Java/Spring     Service       Service (Go)     Service
                Boot)        (Python/AI)    + WebSocket      (Python)
                    │              │              │
               PostgreSQL     PostgreSQL     RabbitMQ
                    └──────────────┴──────────────┘
                         Redis Cache Layer
```

### Services

| Service | Language | Framework | Database | Purpose |
|---------|----------|-----------|----------|---------|
| **API Gateway** | Node.js | Express | Redis | Central routing, JWT auth, RBAC, rate limiting, WebSocket proxy |
| **Auth Service** | Node.js | Express | PostgreSQL | User registration, login, JWT + refresh tokens, account lockout |
| **Employee Service** | Python | FastAPI | MongoDB | Employee CRUD, directory search, multi‑tenant |
| **Payroll Service** | Java | Spring Boot | PostgreSQL | Salary calc, progressive tax, payroll runs |
| **Leave Service** | Java | Spring Boot | PostgreSQL | Leave requests, approval workflow |
| **Attendance Service** | Go | Fiber | PostgreSQL | Clock in/out, overtime calc, live status |
| **Analytics Service** | Python | FastAPI | PostgreSQL | Dept headcount, payroll trends, AI insights |
| **Notification Service** | Go | net/http | In‑memory | WebSocket broadcasting, REST API, RabbitMQ consumer |

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

### Security
- **JWT Authentication** — Access + refresh token rotation
- **RBAC** — Role‑based access control (admin, hr, manager, employee)
- **Account Lockout** — Rate‑limited login with failed attempt tracking
- **Helmet** — HTTP security headers on all Node.js services

### DevOps
- **CI/CD** — GitHub Actions for all 4 runtimes
- **Docker** — Multi‑stage builds for slim production images
- **Kubernetes** — Ready‑to‑deploy manifests
- **Monitoring** — Prometheus metrics + Grafana dashboards

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

This starts **13 containers**: postgres, mongodb, redis, rabbitmq + 9 application services.

### Access

| Service | URL |
|---------|-----|
| Frontend | `http://localhost:3000` |
| API Gateway | `http://localhost:8080` |
| Auth Service | `http://localhost:8010/docs` |
| Analytics Service | `http://localhost:8003/docs` |
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
├── frontend/                          # Next.js application (port 3000)
├── services/
│   ├── api-gateway-node/              # Node.js API Gateway (8080)
│   ├── auth-service/                  # Node.js Auth (8010)
│   ├── employee-python-service/       # Python FastAPI (8001)
│   ├── payroll-java-service/          # Java Spring Boot (8002)
│   ├── analytics-python-service/      # Python FastAPI (8003)
│   ├── notification-go-service/       # Go WebSocket + REST (8004)
│   ├── attendance-service/            # Go Fiber (8005)
│   ├── leave-service/                 # Java Spring Boot (8006)
│   └── integration-service/           # Python (future)
├── k8s/                               # Kubernetes manifests
├── .github/workflows/                 # CI pipeline
├── docker-compose.yml                 # Main orchestration
├── docker-compose.monitoring.yml      # Prometheus + Grafana
├── Makefile                           # Dev CLI commands
└── prometheus.yml                     # Metrics config
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
