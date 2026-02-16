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
RUN npm run dashboard:build

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
RUN npm install --legacy-peer-deps || npm ci --legacy-peer-deps
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/dashboard/.next ./src/dashboard/.next
COPY --from=builder /app/src/dashboard/next.config.js ./src/dashboard/next.config.js
# COPY --from=builder /app/public ./public
COPY --from=builder /app/ecosystem.config.js ./
# Copy database schema for drizzle-kit if needed
COPY --from=builder /app/src/shared/database ./src/shared/database
COPY --from=builder /app/drizzle.config.ts ./
COPY --from=builder /app/scripts ./scripts

# Create unprivileged runtime user and writable directories
RUN groupadd -r appuser && useradd -r -g appuser appuser \
    && mkdir -p /app/logs /app/backups \
    && chown -R appuser:appuser /app \
    && chmod 770 /app/logs /app/backups

# Expose ports
# Bot doesn't need exposed port, but Dashboard does (typically 3000)
EXPOSE 3000

USER appuser

# Start PM2
CMD ["pm2-runtime", "start", "ecosystem.config.js"]
