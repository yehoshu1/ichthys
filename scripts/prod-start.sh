#!/bin/sh
set -eu

MAX_ATTEMPTS="${DB_MIGRATE_MAX_ATTEMPTS:-10}"
RETRY_SECONDS="${DB_MIGRATE_RETRY_SECONDS:-3}"
attempt=1

while [ "$attempt" -le "$MAX_ATTEMPTS" ]; do
  echo "Applying database migrations (attempt ${attempt}/${MAX_ATTEMPTS})..."

  if npm run db:migrate; then
    if [ "${DEPLOY_COMMANDS_ON_START:-false}" = "true" ]; then
      echo "Deploying Discord application commands..."
      npm run deploy:prod
    fi

    echo "Database migrations complete. Starting services..."
    exec pm2-runtime start ecosystem.config.js
  fi

  if [ "$attempt" -eq "$MAX_ATTEMPTS" ]; then
    echo "Database migrations failed after ${MAX_ATTEMPTS} attempts."
    exit 1
  fi

  echo "Migration failed. Retrying in ${RETRY_SECONDS}s..."
  sleep "$RETRY_SECONDS"
  attempt=$((attempt + 1))
done
