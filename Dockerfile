# Base stage
FROM node:20-slim AS base
# Install OpenSSL (required for Drizzle/NextAuth)
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Builder stage
FROM base AS builder
WORKDIR /app

# Install build dependencies for native modules (better-sqlite3)
RUN apt-get update -y && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./
RUN npm ci

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

# Dev stage (for watch mode)
FROM base AS dev
WORKDIR /app
# Install build tools
RUN apt-get update -y && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
# Install ALL dependencies (including devDeps)
RUN npm install
CMD ["npm", "run", "dev:all"]

# Runner stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Install PM2 globally and procps for monitoring
RUN npm install -g pm2 && apt-get update && apt-get install -y procps && rm -rf /var/lib/apt/lists/*

# Copy necessary files
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/dashboard/.next ./src/dashboard/.next
# COPY --from=builder /app/public ./public
COPY --from=builder /app/ecosystem.config.js ./
# Copy database schema for drizzle-kit if needed
COPY --from=builder /app/src/shared/database ./src/shared/database
COPY --from=builder /app/drizzle.config.ts ./

# Create data and logs directories
RUN mkdir -p /app/data /app/logs && chown -R node:node /app/data /app/logs && chmod 777 /app/data /app/logs

# Switch to non-root user
USER node

# Expose ports
# Bot doesn't need exposed port, but Dashboard does (typically 3000)
EXPOSE 3000

# Start PM2
CMD ["pm2-runtime", "start", "ecosystem.config.js"]
