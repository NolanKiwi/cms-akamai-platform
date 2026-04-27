# Infrastructure and CI/CD

## Repository Structure (Monorepo — Turborepo)

```
cms-platform/
├── apps/
│   ├── cms-admin/                # Next.js admin console
│   │   ├── app/                  # App Router pages
│   │   ├── components/           # Admin UI components
│   │   └── Dockerfile
│   ├── web-frontend/             # Next.js public website
│   │   ├── app/                  # App Router pages (ISR/SSR)
│   │   ├── components/
│   │   └── Dockerfile
│   ├── cms-api/                  # NestJS CMS API
│   │   ├── src/
│   │   │   ├── auth/
│   │   │   ├── content/
│   │   │   ├── assets/
│   │   │   ├── video/
│   │   │   ├── publishing/
│   │   │   ├── purge/
│   │   │   ├── redirects/
│   │   │   ├── search/
│   │   │   ├── webhooks/
│   │   │   └── audit/
│   │   └── Dockerfile
│   ├── publisher-worker/         # Publish state machine worker
│   │   ├── src/
│   │   └── Dockerfile
│   ├── purge-worker/             # Akamai Fast Purge worker
│   │   ├── src/
│   │   └── Dockerfile
│   ├── reporting-worker/         # Log processing and metrics worker
│   │   ├── src/
│   │   └── Dockerfile
│   └── search-worker/            # OpenSearch indexing worker
│       ├── src/
│       └── Dockerfile
│
├── packages/
│   ├── shared-types/             # TypeScript types shared across apps
│   │   └── src/
│   │       ├── content.types.ts
│   │       ├── api.types.ts
│   │       └── cache.types.ts
│   ├── content-models/           # Content type schemas and validators
│   │   └── src/
│   ├── akamai-client/            # Akamai API clients (Purge, EdgeKV, PAPI)
│   │   └── src/
│   │       ├── fast-purge.client.ts
│   │       ├── edgekv.client.ts
│   │       └── papi.client.ts
│   ├── security/                 # Auth guards, rate limiters, validators
│   │   └── src/
│   └── ui/                      # Shared React UI components (shadcn/ui based)
│       └── src/
│
├── infra/
│   ├── terraform/
│   │   ├── environments/
│   │   │   ├── staging/
│   │   │   │   ├── main.tf
│   │   │   │   ├── variables.tf
│   │   │   │   └── terraform.tfvars
│   │   │   └── production/
│   │   │       ├── main.tf
│   │   │       ├── variables.tf
│   │   │       └── terraform.tfvars
│   │   └── modules/
│   │       ├── akamai-property/  # Akamai property, hostnames, rules
│   │       ├── akamai-security/  # WAF policies, bot manager config
│   │       ├── database/         # RDS PostgreSQL
│   │       ├── redis/            # ElastiCache Redis
│   │       ├── s3/               # S3 buckets and policies
│   │       ├── kubernetes/       # EKS cluster and node groups
│   │       ├── opensearch/       # OpenSearch domain
│   │       └── observability/    # Prometheus, Grafana, OTel Collector
│   ├── akamai/
│   │   ├── rules/                # Akamai property rule JSON templates
│   │   │   ├── cms-production-www.json
│   │   │   ├── cms-production-media.json
│   │   │   └── cms-production-streams.json
│   │   ├── security/             # WAF policy JSON
│   │   └── edgeworkers/          # EdgeWorker source code
│   │       ├── request-router/
│   │       └── token-auth/
│   └── k8s/
│       ├── base/                 # Kustomize base manifests
│       │   ├── cms-api/
│       │   ├── web-frontend/
│       │   └── workers/
│       └── overlays/
│           ├── staging/
│           └── production/
│
├── docs/
│   ├── architecture/             # Architecture decision records + diagrams
│   ├── runbooks/                 # Operational runbooks
│   └── security/                 # Security policies and ZAP configs
│
├── tests/
│   ├── e2e/                      # Playwright end-to-end tests
│   ├── load/                     # k6 load test scripts
│   ├── security/                 # OWASP ZAP configs (staging only)
│   └── akamai/                   # Akamai staging validation scripts
│
├── .github/
│   └── workflows/                # GitHub Actions CI/CD
│
├── turbo.json                    # Turborepo pipeline config
├── package.json                  # Workspace root
└── CLAUDE.md                     # Project notes for AI tooling
```

---

## Terraform Module Design

### Akamai Property Module

```hcl
# infra/terraform/modules/akamai-property/main.tf

variable "environment"         { type = string }
variable "contract_id"         { type = string }
variable "group_id"            { type = string }
variable "property_name"       { type = string }
variable "hostnames"           { type = list(string) }
variable "origin_hostname"     { type = string }
variable "origin_secret"       { type = string; sensitive = true }
variable "cp_codes"            { type = map(string) }
variable "rules_json"          { type = string }

resource "akamai_cp_code" "codes" {
  for_each    = var.cp_codes
  name        = "${each.key}-${var.environment}"
  contract_id = var.contract_id
  group_id    = var.group_id
  product_id  = "prd_SPM"
}

resource "akamai_edge_hostname" "hostnames" {
  for_each      = toset(var.hostnames)
  product_id    = "prd_SPM"
  contract_id   = var.contract_id
  group_id      = var.group_id
  ip_behavior   = "IPV6_COMPLIANCE"
  edge_hostname = "${each.value}.edgesuite.net"
}

resource "akamai_property" "property" {
  name        = var.property_name
  contract_id = var.contract_id
  group_id    = var.group_id
  product_id  = "prd_SPM"

  dynamic "hostnames" {
    for_each = var.hostnames
    content {
      cname_from             = hostnames.value
      cname_to               = akamai_edge_hostname.hostnames[hostnames.value].edge_hostname
      cert_provisioning_type = "DEFAULT"
    }
  }

  rule_format = "latest"
  rules       = var.rules_json
}

# Staging activation (always activate staging first)
resource "akamai_property_activation" "staging" {
  property_id = akamai_property.property.id
  contact     = ["platform-team@example.com"]
  version     = akamai_property.property.latest_version
  network     = "STAGING"
  note        = "Terraform managed activation"
  
  # Auto-acknowledge warnings (adjust per environment)
  auto_acknowledge_rule_warnings = true
}

# Production activation (conditional on staging passing)
resource "akamai_property_activation" "production" {
  count       = var.environment == "production" ? 1 : 0
  property_id = akamai_property.property.id
  contact     = ["platform-team@example.com"]
  version     = akamai_property.property.latest_version
  network     = "PRODUCTION"
  note        = "Terraform managed activation"
}

output "property_id"     { value = akamai_property.property.id }
output "staging_status"  { value = akamai_property_activation.staging.status }
```

### Database Module (AWS RDS)

```hcl
# infra/terraform/modules/database/main.tf

resource "aws_db_instance" "cms_primary" {
  identifier        = "cms-postgres-${var.environment}"
  engine            = "postgres"
  engine_version    = "16.2"
  instance_class    = var.db_instance_class  # db.r7g.large for production
  allocated_storage = 100
  storage_type      = "gp3"
  storage_encrypted = true
  kms_key_id        = aws_kms_key.db.arn
  
  db_name  = "cms"
  username = "cms_admin"
  password = random_password.db.result  # Stored in Secrets Manager
  
  multi_az               = var.environment == "production"
  backup_retention_period = 7
  backup_window          = "03:00-04:00"
  maintenance_window     = "Sun:04:00-Sun:05:00"
  
  performance_insights_enabled          = true
  performance_insights_retention_period = 7
  monitoring_interval = 60
  monitoring_role_arn = aws_iam_role.rds_monitoring.arn
  
  vpc_security_group_ids = [aws_security_group.db.id]
  db_subnet_group_name   = aws_db_subnet_group.cms.name
  
  deletion_protection = var.environment == "production"
  
  tags = local.common_tags
}

resource "aws_db_instance" "cms_replica" {
  count = var.environment == "production" ? 1 : 0
  
  replicate_source_db = aws_db_instance.cms_primary.identifier
  identifier          = "cms-postgres-replica-${var.environment}"
  instance_class      = var.db_instance_class
  
  performance_insights_enabled = true
  monitoring_interval          = 60
  monitoring_role_arn          = aws_iam_role.rds_monitoring.arn
}

# Store credentials in Secrets Manager
resource "aws_secretsmanager_secret" "db_password" {
  name                    = "cms/${var.environment}/database/password"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id     = aws_secretsmanager_secret.db_password.id
  secret_string = jsonencode({
    username = aws_db_instance.cms_primary.username
    password = random_password.db.result
    host     = aws_db_instance.cms_primary.address
    port     = 5432
    database = "cms"
  })
}
```

---

## GitHub Actions CI/CD

### Main Pipeline

```yaml
# .github/workflows/ci-cd.yml

name: CMS Platform CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_PREFIX: ${{ github.repository }}

jobs:
  # ─────────────────────────────────────────────
  # PHASE 1: Build and Test
  # ─────────────────────────────────────────────
  lint-and-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck

  unit-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env: { POSTGRES_DB: cms_test, POSTGRES_PASSWORD: test }
        options: --health-cmd pg_isready
      redis:
        image: redis:7
        options: --health-cmd "redis-cli ping"
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run test:unit -- --coverage
      - uses: codecov/codecov-action@v4

  integration-tests:
    runs-on: ubuntu-latest
    needs: [unit-tests]
    services:
      postgres:
        image: postgres:16
        env: { POSTGRES_DB: cms_test, POSTGRES_PASSWORD: test }
      redis:
        image: redis:7
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npm run db:migrate:test
      - run: npm run test:integration

  # ─────────────────────────────────────────────
  # PHASE 2: Build Docker Images
  # ─────────────────────────────────────────────
  build-images:
    runs-on: ubuntu-latest
    needs: [lint-and-typecheck, unit-tests]
    strategy:
      matrix:
        app: [cms-api, web-frontend, cms-admin, publisher-worker, purge-worker]
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v5
        with:
          context: apps/${{ matrix.app }}
          push: true
          tags: ${{ env.REGISTRY }}/${{ env.IMAGE_PREFIX }}/${{ matrix.app }}:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  # ─────────────────────────────────────────────
  # PHASE 3: Deploy to Staging
  # ─────────────────────────────────────────────
  deploy-staging:
    runs-on: ubuntu-latest
    needs: [build-images, integration-tests]
    if: github.ref == 'refs/heads/develop' || github.ref == 'refs/heads/main'
    environment: staging
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_STAGING_DEPLOY_ROLE }}
          aws-region: us-east-1
      
      # Deploy application
      - name: Update EKS deployment
        run: |
          aws eks update-kubeconfig --name cms-staging --region us-east-1
          kubectl set image deployment/cms-api \
            cms-api=${{ env.REGISTRY }}/${{ env.IMAGE_PREFIX }}/cms-api:${{ github.sha }} \
            -n cms-staging
          kubectl rollout status deployment/cms-api -n cms-staging --timeout=300s
      
      # Run DB migrations (if any)
      - name: Run database migrations
        run: |
          kubectl run migrate-${{ github.sha }} \
            --image=${{ env.REGISTRY }}/${{ env.IMAGE_PREFIX }}/cms-api:${{ github.sha }} \
            --restart=Never \
            --env="DATABASE_URL=${{ secrets.STAGING_DATABASE_URL }}" \
            -- npm run db:migrate
          kubectl wait --for=condition=complete job/migrate-${{ github.sha }} --timeout=120s
      
      # Apply Akamai staging (Terraform)
      - uses: hashicorp/setup-terraform@v3
      - name: Terraform plan (Akamai staging)
        run: |
          cd infra/terraform/environments/staging
          terraform init
          terraform plan -out=tfplan
      - name: Terraform apply (Akamai staging)
        run: |
          cd infra/terraform/environments/staging
          terraform apply tfplan

  # ─────────────────────────────────────────────
  # PHASE 4: Akamai Staging Validation
  # ─────────────────────────────────────────────
  validate-akamai-staging:
    runs-on: ubuntu-latest
    needs: [deploy-staging]
    steps:
      - uses: actions/checkout@v4
      - name: Run Akamai staging cache tests
        run: |
          npm run test:akamai:staging
        env:
          AKAMAI_STAGING_HOST: staging.example.com
          STAGING_DNS_OVERRIDE: "staging.example.com:80:staging.example.com.edgesuite-staging.net"
      
      - name: Validate cache headers
        run: tests/akamai/validate-cache-headers.sh
      
      - name: Validate security headers
        run: tests/akamai/validate-security-headers.sh
      
      - name: Validate WAF (known-bad payloads → 403)
        run: tests/akamai/validate-waf.sh
      
      - name: Validate purge (tag purge → cache miss)
        run: tests/akamai/validate-purge.sh

  # ─────────────────────────────────────────────
  # PHASE 5: E2E Tests against Staging
  # ─────────────────────────────────────────────
  e2e-tests:
    runs-on: ubuntu-latest
    needs: [validate-akamai-staging]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e
        env:
          BASE_URL: https://staging.example.com
          CMS_API_URL: https://api.staging.example.com

  # ─────────────────────────────────────────────
  # PHASE 6: Deploy to Production (manual gate)
  # ─────────────────────────────────────────────
  deploy-production:
    runs-on: ubuntu-latest
    needs: [e2e-tests]
    if: github.ref == 'refs/heads/main'
    environment:
      name: production
      url: https://www.example.com
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_PRODUCTION_DEPLOY_ROLE }}
          aws-region: us-east-1
      
      - name: Blue/Green deploy to production
        run: |
          aws eks update-kubeconfig --name cms-production --region us-east-1
          # Deploy to green environment
          kubectl set image deployment/cms-api-green \
            cms-api=${{ env.REGISTRY }}/${{ env.IMAGE_PREFIX }}/cms-api:${{ github.sha }} \
            -n cms-production
          kubectl rollout status deployment/cms-api-green -n cms-production --timeout=300s
          # Smoke test green
          npm run test:smoke -- --env=production-green
          # Shift traffic to green (via service selector)
          kubectl patch service cms-api -n cms-production \
            -p '{"spec":{"selector":{"slot":"green"}}}'
      
      - name: Activate Akamai Production
        run: |
          cd infra/terraform/environments/production
          terraform init
          terraform apply -auto-approve
      
      - name: Post-deploy smoke test
        run: npm run test:smoke -- --env=production
      
      - name: Monitor for 5 minutes
        run: |
          sleep 300
          npm run test:smoke -- --env=production
```

---

## Kubernetes Deployment Config

```yaml
# infra/k8s/base/cms-api/deployment.yaml

apiVersion: apps/v1
kind: Deployment
metadata:
  name: cms-api
  namespace: cms
spec:
  replicas: 3
  selector:
    matchLabels: {app: cms-api}
  strategy:
    type: RollingUpdate
    rollingUpdate: {maxSurge: 1, maxUnavailable: 0}
  template:
    metadata:
      labels: {app: cms-api}
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "9090"
    spec:
      serviceAccountName: cms-api
      containers:
        - name: cms-api
          image: ghcr.io/example/cms-api:latest  # overridden by overlay
          ports:
            - containerPort: 3000
            - containerPort: 9090  # metrics
          env:
            - name: NODE_ENV
              value: production
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef: {name: cms-secrets, key: database-url}
            - name: REDIS_URL
              valueFrom:
                secretKeyRef: {name: cms-secrets, key: redis-url}
          envFrom:
            - configMapRef: {name: cms-config}
          resources:
            requests: {cpu: 250m, memory: 512Mi}
            limits:   {cpu: 1000m, memory: 1Gi}
          livenessProbe:
            httpGet: {path: /health, port: 3000}
            initialDelaySeconds: 10
            periodSeconds: 15
          readinessProbe:
            httpGet: {path: /ready, port: 3000}
            initialDelaySeconds: 5
            periodSeconds: 10
          securityContext:
            runAsNonRoot: true
            runAsUser: 1001
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
```

---

## Blue/Green Deployment Strategy

```
Production runs two identical sets:
  cms-api-blue   (active, receives traffic)
  cms-api-green  (standby, receives deploy)

Deploy process:
  1. Build new image → tagged with git SHA
  2. Deploy to green environment (zero traffic)
  3. Health checks pass on green
  4. Run smoke tests against green (via internal URL)
  5. Shift Kubernetes Service selector: blue → green
  6. Monitor for 5 minutes (error rate, latency)
  7. If OK: rename green → active, old blue → standby (for next deploy)
  8. If error: revert Service selector back to blue (< 30s rollback)

Database migrations:
  MUST be backward-compatible (both blue and green versions work):
  - Add column: nullable or with default (safe)
  - Drop column: done in 3 deploys (1: stop using, 2: drop FK, 3: drop column)
  - Rename column: done via alias (add new column, dual-write, switch reads, drop old)
  - Index changes: CREATE INDEX CONCURRENTLY (non-blocking)

Akamai rollback:
  Terraform state contains previous version number
  Manual rollback:
    1. Navigate to Akamai Luna Portal → Property → Versions
    2. Activate previous version to Production
    OR via Terraform:
    terraform apply -var="property_version=N-1"
```

---

## Multi-Region Strategy (Phase 9)

```
Primary region: us-east-1 (Virginia)
  - Primary PostgreSQL
  - Primary Redis cluster
  - Primary app tier

Secondary region: eu-west-1 (Ireland)
  - Read replica PostgreSQL
  - Redis replica cluster
  - App tier (read-only serving or full stack)
  
Akamai origin failover:
  Origin Group:
    Primary: origin.us-east-1.example.com (load balancer in us-east-1)
    Fallback: origin.eu-west-1.example.com (load balancer in eu-west-1)
  Failover trigger: Primary returns 5xx for 3 consecutive requests
  Failover mode: failover_duration=60s (attempt primary again after 60s)
  
DNS: Route53 health-check-based routing
  www.example.com → us-east-1 LB (primary)
  If primary health check fails → eu-west-1 LB

Data strategy:
  Content (PostgreSQL): async replication (eventual consistency ~1s lag acceptable for CMS)
  Media assets (S3): cross-region replication (S3 CRR)
  Redis: replica in secondary region (reads only; writes go to primary)
  Search (OpenSearch): separate domain per region, dual-write on publish
```
