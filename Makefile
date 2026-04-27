# ─────────────────────────────────────────────────────────────
# CMS Akamai Platform — Makefile
# Usage: make <target>
# ─────────────────────────────────────────────────────────────

.PHONY: help setup dev down logs test test-unit test-integration test-e2e \
        test-akamai test-load test-security lint typecheck build \
        db-migrate db-seed purge-tags purge-urls infra-staging infra-prod \
        jwt-keygen docker-clean

# Default target
help:
	@echo ""
	@echo "CMS Akamai Platform — Available Commands"
	@echo "─────────────────────────────────────────"
	@echo "  Setup:"
	@echo "    make setup           First-time setup (install deps, generate keys, start infra)"
	@echo "    make jwt-keygen      Generate JWT RS256 key pair into ./keys/"
	@echo ""
	@echo "  Development:"
	@echo "    make dev             Start all services (Docker infra + app servers)"
	@echo "    make down            Stop all Docker services"
	@echo "    make logs            Follow Docker Compose logs"
	@echo "    make build           Build all apps"
	@echo ""
	@echo "  Database:"
	@echo "    make db-migrate      Run pending migrations"
	@echo "    make db-seed         Seed development data"
	@echo ""
	@echo "  Testing:"
	@echo "    make test            Run all tests"
	@echo "    make test-unit       Unit tests only"
	@echo "    make test-integration Integration tests only"
	@echo "    make test-e2e        Playwright E2E tests (requires running stack)"
	@echo "    make test-akamai     Akamai staging cache/header validation"
	@echo "    make test-load       k6 load tests (requires running stack)"
	@echo "    make test-security   OWASP ZAP security scan (staging only)"
	@echo ""
	@echo "  Cache Purge (requires AKAMAI_* env vars):"
	@echo "    make purge-tags TAGS='article:uuid listing:articles'"
	@echo "    make purge-urls URLS='https://www.example.com/articles/slug'"
	@echo ""
	@echo "  Infrastructure:"
	@echo "    make infra-staging   terraform plan + apply (staging)"
	@echo "    make infra-prod      terraform plan only (production — apply manually)"
	@echo ""

# ─────────────────────────────────────────────────────────────
# Setup
# ─────────────────────────────────────────────────────────────
setup: jwt-keygen
	@echo "→ Installing dependencies..."
	npm install
	@echo "→ Copying .env.example → .env (if not exists)..."
	@test -f .env || cp .env.example .env
	@echo "→ Starting infrastructure containers..."
	docker compose up -d postgres redis minio opensearch
	@echo "→ Waiting for PostgreSQL..."
	@until docker compose exec postgres pg_isready -U cms_admin -d cms 2>/dev/null; do sleep 2; done
	@echo "→ Running database migrations..."
	npm run db:migrate
	@echo "→ Seeding development data..."
	npm run db:seed
	@echo ""
	@echo "✓ Setup complete. Run 'make dev' to start the application."
	@echo ""
	@echo "  Services:"
	@echo "    CMS Admin:      http://localhost:3001"
	@echo "    Web Frontend:   http://localhost:3000"
	@echo "    CMS API:        http://localhost:4000"
	@echo "    API Docs:       http://localhost:4000/api/docs"
	@echo "    MinIO Console:  http://localhost:9001  (user: cms_dev_access)"
	@echo "    Grafana:        http://localhost:3100  (user: admin)"
	@echo "    Prometheus:     http://localhost:9090"
	@echo "    OpenSearch:     http://localhost:5601"
	@echo "    Mailhog:        http://localhost:8025"

jwt-keygen:
	@mkdir -p keys
	@if [ ! -f keys/jwt-private.pem ]; then \
		echo "→ Generating JWT RS256 key pair..."; \
		openssl genrsa -out keys/jwt-private.pem 4096 2>/dev/null; \
		openssl rsa -in keys/jwt-private.pem -pubout -out keys/jwt-public.pem 2>/dev/null; \
		echo "✓ Keys generated in ./keys/ (git-ignored)"; \
	else \
		echo "✓ JWT keys already exist in ./keys/"; \
	fi

# ─────────────────────────────────────────────────────────────
# Development
# ─────────────────────────────────────────────────────────────
dev:
	docker compose up -d
	npm run dev

down:
	docker compose down

logs:
	docker compose logs -f

build:
	npm run build

docker-clean:
	docker compose down -v --remove-orphans
	@echo "✓ All containers and volumes removed"

# ─────────────────────────────────────────────────────────────
# Database
# ─────────────────────────────────────────────────────────────
db-migrate:
	npm run db:migrate

db-seed:
	npm run db:seed

# ─────────────────────────────────────────────────────────────
# Testing
# ─────────────────────────────────────────────────────────────
test:
	npm run test

test-unit:
	npm run test:unit

test-integration:
	npm run test:integration

test-e2e:
	npm run test:e2e

test-akamai:
	@echo "→ Running Akamai staging validation..."
	@test -n "$(AKAMAI_STAGING_HOST)" || (echo "ERROR: Set AKAMAI_STAGING_HOST"; exit 1)
	bash tests/akamai/validate-cache-headers.sh
	bash tests/akamai/validate-security-headers.sh
	bash tests/akamai/validate-waf.sh

test-load:
	@echo "→ Running k6 load tests..."
	@which k6 > /dev/null || (echo "ERROR: k6 not installed. See https://k6.io/docs/get-started/installation/"; exit 1)
	k6 run tests/load/publishing-pipeline.js

test-security:
	@echo "→ Running OWASP ZAP security scan (STAGING ONLY)..."
	@test "$(TARGET_ENV)" = "staging" || (echo "ERROR: Set TARGET_ENV=staging. Never run against production."; exit 1)
	docker run --rm \
		-v $$(pwd)/tests/security/reports:/reports \
		ghcr.io/zaproxy/zaproxy:stable \
		zap-automation.sh -autorun /zap/wrk/zap-config.yaml

# ─────────────────────────────────────────────────────────────
# Cache Purge (manual)
# ─────────────────────────────────────────────────────────────
purge-tags:
	@test -n "$(TAGS)" || (echo "Usage: make purge-tags TAGS='article:uuid listing:articles'"; exit 1)
	node scripts/manual-purge.js tags "$(TAGS)"

purge-urls:
	@test -n "$(URLS)" || (echo "Usage: make purge-urls URLS='https://www.example.com/path'"; exit 1)
	node scripts/manual-purge.js urls "$(URLS)"

# ─────────────────────────────────────────────────────────────
# Infrastructure
# ─────────────────────────────────────────────────────────────
infra-staging:
	cd infra/terraform/environments/staging && \
		terraform init && \
		terraform plan -out=tfplan && \
		terraform apply tfplan

infra-prod:
	@echo "→ Production plan only — apply manually after review"
	cd infra/terraform/environments/production && \
		terraform init && \
		terraform plan
