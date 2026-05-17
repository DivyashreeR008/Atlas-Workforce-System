.PHONY: help up down restart status logs clean build-all test test-e2e

help:
	@echo "Atlas Workforce System Development CLI"
	@echo ""
	@echo "Usage:"
	@echo "  make up          Start the entire microservices stack"
	@echo "  make down        Stop the entire microservices stack"
	@echo "  make restart     Restart all services"
	@echo "  make status      Check service logs status"
	@echo "  make logs        Tail logs from all services"
	@echo "  make build-all   Force rebuild of all service Docker images"
	@echo "  make test        Execute all unit/integration tests"
	@echo "  make test-e2e    Execute Playwright end-to-end integration tests"
	@echo "  make clean       Stop services and prune unused volumes/containers"

up:
	docker compose up -d

down:
	docker compose down

restart:
	docker compose restart

status:
	docker compose ps

logs:
	docker compose logs -f

build-all:
	docker compose build --no-cache

clean:
	docker compose down -v
	docker system prune -f

test:
	@echo "Running all backend tests..."
	cd services/auth-service && npm test || true
	cd services/payroll-java-service && mvn test || true
	cd services/leave-service && mvn test || true

test-e2e:
	@echo "Running Playwright End-to-End test suite..."
	cd frontend && npx playwright test

