# ─── Stage 1: Build UI ──────────────────────────────────────────────────────
FROM node:20-alpine AS ui-builder
WORKDIR /app/ui
COPY ui/package*.json ./
RUN npm ci
COPY ui/ .
RUN npm run build

# ─── Stage 2: Build API ─────────────────────────────────────────────────────
FROM node:20-alpine AS api-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY src/ ./src/
COPY tsconfig.json nest-cli.json ./
RUN npx nest build

# ─── Stage 3: Production dependencies only ──────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# ─── Stage 4: All-in-one runtime (PostgreSQL + Node API + static UI) ───────
FROM postgres:16-alpine

# Install Node.js (no npm needed at runtime)
RUN apk add --no-cache nodejs

WORKDIR /app

# Server code + production-only node_modules
COPY --from=api-builder /app/dist ./dist
COPY --from=deps /app/node_modules ./node_modules
COPY --from=api-builder /app/package.json ./

# Database schema
COPY src/database/schema.sql ./schema.sql

# Built UI static files
COPY --from=ui-builder /app/ui/dist ./ui/dist

# Entrypoint script
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Default environment (can be overridden at runtime)
ENV POSTGRES_USER=mediatorflow \
    POSTGRES_PASSWORD=mediatorflow \
    POSTGRES_DB=mediatorflow \
    DATABASE_URL=postgres://mediatorflow:mediatorflow@localhost:5432/mediatorflow \
    PORT=4800 \
    PGDATA=/var/lib/postgresql/data

# Only the API port is exposed; PostgreSQL stays internal
EXPOSE 4800

ENTRYPOINT ["/entrypoint.sh"]
