#!/bin/sh
set -e

# Ensure the directory for the SQLite database file exists.
# DATABASE_URL is expected to look like: file:/data/wardly.db
DB_PATH=$(echo "$DATABASE_URL" | sed 's/^file://')
DB_DIR=$(dirname "$DB_PATH")
mkdir -p "$DB_DIR"

echo "→ Applying database migrations..."
./node_modules/.bin/prisma migrate deploy

echo "→ Starting Next.js production server..."
exec ./node_modules/.bin/next start -H "${HOSTNAME:-0.0.0.0}" -p "${PORT:-3000}"
