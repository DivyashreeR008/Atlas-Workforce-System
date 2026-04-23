
# Atlas Workforce System

A production‑inspired, polyglot microservices platform for **employee onboarding, payroll processing, and real‑time notifications** in a distributed environment.

---

## 🎯 Why this project?

This project was built to explore **distributed system design**, **polyglot microservices**, and **event‑driven architectures** in a realistic HR/Workforce context. It simulates how a startup or mid‑sized company might manage employees, payroll, and analytics across decoupled services, with an eye toward scalability and observability.

---

## 🚀 Overview

Atlas Workforce System is a distributed, event‑driven application that manages:

- Employee onboarding and lifecycle management  
- Payroll processing and tax handling  
- Real‑time notifications (email/alerts)  
- Workforce analytics and reporting  

The system is structured as a **microservices architecture**, enabling independent deployment, scaling, and technology‑specific optimizations for each service.

---

## 🏗️ System Architecture

Atlas consists of the following core services:

- **API Gateway** (Node.js / Express) – Central entry point for all client requests, handles routing and future authentication.  
- **Employee Service** (Python / FastAPI) – Manages creation, retrieval, updating, and deletion of employee records.  
- **Payroll Service** (Java / Spring Boot) – Handles salary calculations, tax computations, and payroll runs.  
- **Analytics Service** (Python) – Provides workforce analytics and reporting over employee and payroll data.  
- **Notification Service** (Go) – Sends alerts and notifications via email or internal messaging.  
- **Message Broker** (RabbitMQ) – Enables event‑driven communication (e.g., `employee_created`, `payroll_processed`).  

Services are loosely coupled, independently deployable, and communicate via asynchronous events for resilience and fault tolerance.

---

## 🔁 Architecture diagram (concept)

```
         Frontend (Next.js)
                  ↓
            API Gateway
                  ↓
  ┌──────────────┼──────────────┐
  ↓              ↓              ↓
Employee     Payroll      Analytics
 Service      Service        Service
  ↓              ↓              ↓
MongoDB      PostgreSQL    Elasticsearch
  ↓              ↓
  └──────────────┴──────────────┘
                  ↓
               RabbitMQ
                  ↓
        Notification Service
                  ↓
              Email/SMS
```

This layout emphasizes **separation of concerns**, **event‑driven flows**, and **multi‑database integration**.

---

## 🛠️ Tech Stack

### Frontend
- **Next.js** – React‑based framework for server‑side rendering and static site generation.  
- **React** – Component‑driven UI.  
- **Tailwind CSS** – Utility‑first styling.  

### Backend Services
- **Node.js (Express)** – API Gateway.  
- **Python (FastAPI)** – Employee and Analytics services.  
- **Java (Spring Boot)** – Payroll service (enterprise‑grade reliability).  
- **Go (Golang)** – Notification service (high‑concurrency, low‑latency).  

### Databases & Storage
- **MongoDB** – Document‑oriented storage for employee data.  
- **PostgreSQL** – Relational database for payroll and transactional data.  
- **Redis** – In‑memory caching for performance.  
- **Elasticsearch** – Analytics and search‑oriented storage.  

### Infrastructure & DevOps
- **Docker** – Containerization for consistent environments.  
- **docker compose** – Local orchestration of multi‑service applications.  
- **RabbitMQ** – Message‑oriented middleware for event‑driven communication.  
- **Resilience‑oriented design** – Retry patterns and fault‑tolerant communication (signals system‑design thinking).  

---

## ✨ Key Features

- **Microservices‑based architecture** with independent deployment and scaling.  
- **API Gateway pattern** for centralized routing, future security (JWT/OAuth2), and observability.  
- **Event‑driven communication** using RabbitMQ to decouple services.  
- **Multi‑database integration** supporting both relational and document‑oriented models.  
- **Containerized deployment** for reproducible, production‑like environments.  
- **Resilience‑oriented** design (retries, fault tolerance, structured logging in future).  

---

## 📡 Sample APIs

### Employee Service

- `POST /employees` → Create a new employee.  
- `GET /employees/{id}` → Fetch an employee by ID.  
- `PUT /employees/{id}` → Update employee details.  
- `DELETE /employees/{id}` → Delete an employee.  

### Payroll Service

- `POST /payroll/process` → Trigger payroll processing for a given period.  
- `GET /payroll/{employeeId}` → Fetch payroll history for an employee.  

### Notification Service

- `POST /notifications/send` → Send an alert/email (triggered via RabbitMQ events).  

These endpoints demonstrate real‑world HR workflows and integration points.

---

## 📂 Project Structure

```text
Atlas-Workforce-System/
│
├── frontend/                      # Next.js frontend application
├── services/
│   ├── api-gateway-node/          # Node.js / Express API Gateway
│   ├── employee-python-service/   # Python / FastAPI Employee Service
│   ├── payroll-java-service/      # Java / Spring Boot Payroll Service
│   ├── analytics-python-service/  # Python Analytics Service
│   └── notification-go-service/   # Go Notification Service
│
├── docker-compose.yml             # Container orchestration configuration
└── README.md                      # Project documentation
```

---

## ⚙️ Getting Started

### Prerequisites

- **Docker**  
- **docker compose** (modern Docker CLI)  

---

### ▶️ Run the Project

1. Clone the repository:

   ```bash
   git clone https://github.com/Senthil455/Atlas-Workforce-System.git
   cd Atlas-Workforce-System
   ```

2. Build and start all services:

   ```bash
   docker compose up --build
   ```

   This command:
   - Builds each service container (if Dockerfiles exist).  
   - Starts MongoDB, PostgreSQL, Redis, and Elasticsearch.  
   - Launches RabbitMQ as the message broker.  
   - Spins up the API Gateway and all microservices.  

---

### 🌐 Access Services

- **Frontend (Next.js UI)** → `http://localhost:3000`  
- **API Gateway** → `http://localhost:8081`  

From the frontend, requests flow through the API Gateway to the appropriate microservice, with events communicated via RabbitMQ and data stored in the respective databases.

---

### 🔄 Workflow Summary

1. User interacts with the **Next.js frontend**.  
2. Requests are routed through the **API Gateway**.  
3. Gateway forwards the request to the relevant **microservice** (Employee, Payroll, Analytics, or Notification).  
4. Services emit **events** (e.g., `employee_created`, `payroll_processed`) to **RabbitMQ**.  
5. **Notification Service** consumes these events and sends alerts.  
6. Data is persisted in **MongoDB, PostgreSQL, Redis, Elasticsearch**.  

---


## 📌 Future Improvements

- **Authentication & Authorization** (JWT, role‑based access: Admin/HR).  
- **API Documentation** (Swagger/OpenAPI for each service).  
- **Observability** (Prometheus, Grafana, ELK stack).  
- **Deployment** (AWS/GCP, Kubernetes, CI/CD).  
- **Resilience** – Retry policies, circuit breakers (e.g., Hystrix‑style patterns).  

---

## 👨‍💻 Author

**Senthil Raja R**  
Full Stack Developer | AI Automation Enthusiast  

- 📧 Email: [senthilrajasen637@gmail.com](mailto:senthilrajasen637@gmail.com)  
- 🔗 LinkedIn: [https://www.linkedin.com/in/senthil-raja-r-a29839329/](https://www.linkedin.com/in/senthil-raja-r-a29839329/)  

---

## ⭐ Support

If you found this project useful, consider giving it a **⭐ on GitHub** to support its continued development and improvement.
