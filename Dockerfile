# syntax=docker/dockerfile:1

# -----------------------------------------------------------------------------
# Stage 1: Base Alpine image with Node.js
# -----------------------------------------------------------------------------
FROM node:22-alpine AS base

RUN apk add --no-cache libc6-compat
WORKDIR /app

# -----------------------------------------------------------------------------
# Stage 2: Install dependencies
# -----------------------------------------------------------------------------
FROM base AS deps

COPY package.json package-lock.json* ./

RUN npm ci

# -----------------------------------------------------------------------------
# Stage 3: Build application
# -----------------------------------------------------------------------------
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV LOCAL_JSON_DB=true

RUN npm run build

# -----------------------------------------------------------------------------
# Stage 4: Production runner
# -----------------------------------------------------------------------------
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Security: Run as non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy static assets
COPY --from=builder /app/public ./public

# Setup .next directory permissions
RUN mkdir .next && chown nextjs:nodejs .next

# Leverage Next.js standalone output to minimize image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Ensure persistent local-db folder exists and is writable
RUN mkdir -p /app/.local-db && chown -R nextjs:nodejs /app/.local-db

USER nextjs

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]

