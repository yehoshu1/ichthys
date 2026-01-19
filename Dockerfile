# Base stage
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat

# Builder stage
FROM base AS builder
WORKDIR /app

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
RUN npm run dashboard:build

# Runner stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Install PM2 globally
RUN npm install -g pm2

# Copy necessary files
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/dashboard/.next ./src/dashboard/.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/ecosystem.config.js ./
# Copy database schema for drizzle-kit if needed
COPY --from=builder /app/src/shared/database ./src/shared/database
COPY --from=builder /app/drizzle.config.ts ./

# Create data directory for SQLite
RUN mkdir -p /app/data && chown node:node /app/data

# Switch to non-root user
USER node

# Expose ports
# Bot doesn't need exposed port, but Dashboard does (typically 3000)
EXPOSE 3000

# Start PM2
CMD ["pm2-runtime", "start", "ecosystem.config.js"]
