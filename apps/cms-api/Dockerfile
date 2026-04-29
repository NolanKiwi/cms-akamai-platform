# syntax=docker/dockerfile:1.6
# ── stage 1: deps ─────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /repo
# Copy only manifests for cacheable install
COPY package.json package-lock.json ./
COPY apps/cms-api/package.json ./apps/cms-api/
COPY apps/cms-admin/package.json ./apps/cms-admin/
COPY apps/web-frontend/package.json ./apps/web-frontend/
COPY apps/publisher-worker/package.json ./apps/publisher-worker/
COPY apps/purge-worker/package.json ./apps/purge-worker/
COPY apps/reporting-worker/package.json ./apps/reporting-worker/
COPY apps/search-worker/package.json ./apps/search-worker/
RUN apk add --no-cache python3 make g++ \
    && npm ci --workspaces=false --include-workspace-root \
       --workspace=cms-api

# ── stage 2: build ────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /repo
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/cms-api/node_modules ./apps/cms-api/node_modules
COPY . .
WORKDIR /repo/apps/cms-api
RUN npm run build

# ── stage 3: runtime ──────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache tini && \
    addgroup -S app && adduser -S -G app app

COPY --from=build /repo/apps/cms-api/dist ./dist
COPY --from=build /repo/apps/cms-api/package.json ./
COPY --from=build /repo/node_modules ./node_modules
# JWT keys are runtime config — provide via volume or secret manager.
RUN mkdir -p /app/keys && chown -R app:app /app

USER app
EXPOSE 17000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main"]
