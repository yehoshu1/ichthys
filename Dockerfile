# Base stage with Node.js
FROM node:22-bookworm-slim AS base
# Install OpenSSL and PostgreSQL client tooling (required for NextAuth and backup scripts)
RUN apt-get update -y && apt-get install -y openssl postgresql-client && rm -rf /var/lib/apt/lists/*
# Use latest npm across all stages
RUN npm install -g npm@11.9.0

# Dev stage (for watch mode)
FROM base AS dev
WORKDIR /app
# Install build tools and canvas dependencies
RUN apt-get update -y && apt-get install -y python3 make g++ pkg-config libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json package-lock.json ./
# Install ALL dependencies (including devDeps)
# Using npm install instead of npm ci to handle cases where package.json has newer packages
RUN npm install --legacy-peer-deps || npm ci --legacy-peer-deps

# Copy source
COPY . .
RUN chmod +x /app/scripts/dev-start.sh

# Start dev server
CMD ["sh", "/app/scripts/dev-start.sh"]

# Builder stage
FROM base AS builder
WORKDIR /app

# Install build dependencies for native modules (including canvas)
RUN apt-get update -y && apt-get install -y python3 make g++ pkg-config libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json package-lock.json ./
# Install ALL dependencies (including devDeps)
# Using npm install instead of npm ci to handle cases where package.json has newer packages
RUN npm install --legacy-peer-deps || npm ci --legacy-peer-deps

# Copy source
COPY . .

# Build Bot
RUN npm run build

# Build Dashboard
# Disable telemetry for build
ENV NEXT_TELEMETRY_DISABLED=1
# Next.js requires .env file to exist even if empty
RUN touch .env && mkdir -p src/dashboard && touch src/dashboard/.env
RUN bash -lc 'SKIP_NEXT_TYPECHECK=1 npm run dashboard:build & pid=$!; while kill -0 "$pid" 2>/dev/null; do echo "[build] dashboard build in progress..."; sleep 15; done; wait "$pid"'
RUN rm -rf /app/src/dashboard/.next/cache /app/src/dashboard/.next/types /app/src/dashboard/.next/trace-build /app/src/dashboard/.next/diagnostics

# Runner stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Install PM2 globally and procps for monitoring
RUN apt-get update && apt-get install -y procps && npm install -g pm2 && rm -rf /var/lib/apt/lists/*

# Copy necessary files
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./
RUN npm ci --omit=dev --legacy-peer-deps --no-audit --no-fund \
    && npm cache clean --force \
    && rm -rf /root/.npm /tmp/*
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/dashboard/.next ./src/dashboard/.next
COPY --from=builder /app/src/dashboard/.source ./src/dashboard/.source
COPY --from=builder /app/src/dashboard/content ./src/dashboard/content
COPY --from=builder /app/src/dashboard/content ./content
COPY --from=builder /app/src/dashboard/next.config.mjs ./src/dashboard/next.config.mjs
COPY --from=builder /app/src/dashboard/source.config.ts ./src/dashboard/source.config.ts
# COPY --from=builder /app/public ./public
COPY --from=builder /app/ecosystem.config.js ./
# Copy database schema for drizzle-kit if needed
COPY --from=builder /app/src/shared/database ./src/shared/database
COPY --from=builder /app/drizzle.config.ts ./
COPY --from=builder /app/scripts ./scripts

# Runtime does not need source maps or npm caches.
RUN rm -rf /app/node_modules/.cache \
    && find /app/node_modules -type f -name '*.map' -delete

# Create unprivileged runtime user and writable directories
RUN groupadd -r appuser && useradd -r -g appuser -m appuser \
    && mkdir -p /app/logs /app/backups /app/data /home/appuser/.pm2 \
    && chown -R appuser:appuser /app /home/appuser \
    && chmod -R 770 /app/logs /app/backups /app/data

# Expose ports
# Bot doesn't need exposed port, but Dashboard does (runs on 4002 as configured in docker-compose.yml and README)
EXPOSE 4002

USER appuser

# Run migrations, then start PM2
CMD ["sh", "/app/scripts/prod-start.sh"]
