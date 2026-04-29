# syntax=docker/dockerfile:1.6
FROM node:20-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/web-frontend/package.json ./apps/web-frontend/
COPY apps/cms-api/package.json ./apps/cms-api/
COPY apps/cms-admin/package.json ./apps/cms-admin/
COPY apps/publisher-worker/package.json ./apps/publisher-worker/
COPY apps/purge-worker/package.json ./apps/purge-worker/
COPY apps/reporting-worker/package.json ./apps/reporting-worker/
COPY apps/search-worker/package.json ./apps/search-worker/
RUN npm ci --workspaces=false --include-workspace-root --workspace=web-frontend

FROM node:20-alpine AS build
WORKDIR /repo
COPY --from=deps /repo/node_modules ./node_modules
COPY . .
WORKDIR /repo/apps/web-frontend
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S -G app app
COPY --from=build /repo/apps/web-frontend/.next ./.next
COPY --from=build /repo/apps/web-frontend/public ./public
COPY --from=build /repo/apps/web-frontend/package.json ./
COPY --from=build /repo/apps/web-frontend/next.config.js ./
COPY --from=build /repo/node_modules ./node_modules
USER app
EXPOSE 17002
CMD ["npm", "run", "start"]
