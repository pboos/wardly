# syntax=docker/dockerfile:1

# -----------------------------------------------------------------------------
# Base image — Node.js + bun (bun is used for lockfile-based installs)
# -----------------------------------------------------------------------------
FROM node:24-bookworm-slim AS base
RUN npm install -g bun

# -----------------------------------------------------------------------------
# deps stage — install all dependencies (including devDependencies)
#   build-essential / python3 are needed to compile better-sqlite3 native bindings
# -----------------------------------------------------------------------------
FROM base AS deps
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# -----------------------------------------------------------------------------
# builder stage — generate the Prisma client and build the Next.js app
# -----------------------------------------------------------------------------
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV DATABASE_URL="file:/data/wardly.db"
RUN bun run db:generate
RUN bun run build

# -----------------------------------------------------------------------------
# runner stage — minimal production image
# -----------------------------------------------------------------------------
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# Default SQLite path — mount a volume at /data so the database persists
ENV DATABASE_URL="file:/data/wardly.db"

# node_modules (includes next CLI, prisma CLI, better-sqlite3 native bindings, etc.)
COPY --from=builder /app/node_modules ./node_modules
# Next.js build output + static assets
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
# Config files
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/package.json ./
# Prisma — schema, config, and committed migrations (needed by `migrate deploy`)
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./
# Generated Prisma client (gitignored, regenerated during build)
COPY --from=builder /app/generated ./generated
# Entrypoint
COPY entrypoint.sh ./
RUN chmod +x ./entrypoint.sh

# Persistent data directory for the SQLite database file
RUN mkdir -p /data
VOLUME /data

EXPOSE 3000
CMD ["./entrypoint.sh"]
