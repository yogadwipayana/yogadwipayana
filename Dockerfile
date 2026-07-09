# syntax=docker/dockerfile:1.7

# ─────────────────────────────────────────────────────────────────────────────
# 1. deps — install production + dev dependencies (needed for build)
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

# OpenSSL is needed by the `postinstall` hook (prisma generate) during npm ci.
RUN apk add --no-cache openssl

COPY package.json package-lock.json ./
COPY prisma ./prisma

RUN npm ci

# ─────────────────────────────────────────────────────────────────────────────
# 2. builder — produce the Next.js production build
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

# OpenSSL is required by Prisma's query engine on Alpine (musl).
RUN apk add --no-cache openssl

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time env — pass real values via --build-arg in CI / docker-compose.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_POSTHOG_KEY
ARG NEXT_PUBLIC_POSTHOG_HOST
ARG NEXT_PUBLIC_GA_MEASUREMENT_ID

ENV NEXT_TELEMETRY_DISABLED=1

# Regenerate the Prisma client for this image's platform. src/generated is
# dockerignored (it holds Windows engines from the host), so it must be
# rebuilt here before `next build` imports it.
RUN npx prisma generate

RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────
# 3. runner — minimal production image
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

# OpenSSL is required by Prisma's query engine at runtime on Alpine (musl).
RUN apk add --no-cache openssl

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Non-root user
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Public assets
COPY --from=builder /app/public ./public

# Next.js build output
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next

# Custom server + source files needed at runtime
COPY --from=builder /app/server.mjs ./server.mjs
COPY --from=builder /app/src/lib/server ./src/lib/server
COPY --from=builder /app/package.json ./package.json

# Production node_modules (includes Prisma generated client)
COPY --from=builder /app/node_modules ./node_modules

# Prisma generated client
COPY --from=builder /app/src/generated ./src/generated

USER nextjs

EXPOSE 3000

CMD ["node", "--experimental-strip-types", "server.mjs"]
