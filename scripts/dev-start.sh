#!/bin/sh
set -eu

LOCKFILE="/app/package-lock.json"
NODE_MODULES_DIR="/app/node_modules"
HASH_FILE="${NODE_MODULES_DIR}/.package-lock.sha256"

mkdir -p /app/data "${NODE_MODULES_DIR}"

current_hash="$(sha256sum "${LOCKFILE}" | awk '{print $1}')"
saved_hash=""
if [ -f "${HASH_FILE}" ]; then
  saved_hash="$(cat "${HASH_FILE}" || true)"
fi

if [ ! -d "${NODE_MODULES_DIR}/.bin" ] || [ "${current_hash}" != "${saved_hash}" ]; then
  echo "Dependencies out of sync. Running npm install..."
  npm install
  printf '%s' "${current_hash}" > "${HASH_FILE}"
fi

# Prevent stale chunk references between restarts/branch switches in dev.
rm -rf /app/src/dashboard/.next

npm run db:migrate

exec npm run dev:all
