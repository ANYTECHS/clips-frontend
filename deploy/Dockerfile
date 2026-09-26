# Multi-stage build — produces a minimal production image for Fly.io,
# Kubernetes, Render, Railway, or any Docker-compatible host.
#
# Build args (pass with --build-arg or in CI):
#   NODE_VERSION — defaults to 20-alpine (LTS). Pin to a specific patch for
#                  reproducible builds: e.g. 20.15.1-alpine3.20

ARG NODE_VERSION=20-alpine
# ─── Stage 1: Install dependencies ───────────────────────────────────────────
FROM node:${NODE_VERSION} AS deps
WORKDIR /app

# Copy manifests only — Docker cache busts only when they change.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

# ─── Stage 2: Build ───────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS builder
WORKDIR /app

# All deps (including devDependencies) needed for the build.
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY . .

# Build args that must be baked into the bundle at build time.
# Pass real values via CI --build-arg or Docker Compose build.args.
ARG NEXT_PUBLIC_SENTRY_DSN=""
ARG NEXT_PUBLIC_AI_API_URL=""
ARG NEXT_PUBLIC_API_URL=""
ARG NEXT_PUBLIC_ANALYTICS_PROVIDER="none"
ARG NEXT_PUBLIC_STELLAR_NETWORK="mainnet"
ARG NEXT_PUBLIC_CDN_URL=""

ENV NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN \
    NEXT_PUBLIC_AI_API_URL=$NEXT_PUBLIC_AI_API_URL \
    NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_ANALYTICS_PROVIDER=$NEXT_PUBLIC_ANALYTICS_PROVIDER \
    NEXT_PUBLIC_STELLAR_NETWORK=$NEXT_PUBLIC_STELLAR_NETWORK \
    NEXT_PUBLIC_CDN_URL=$NEXT_PUBLIC_CDN_URL \
    # Required by validateRequiredEnv() in next.config.ts.
    # These are placeholder values; real runtime secrets are injected via
    # environment variables — they are never baked into the image.
    NEXTAUTH_SECRET="build-placeholder" \
    NEXTAUTH_URL="http://localhost:3000" \
    AI_BACKEND_CALLBACK_SECRET="build-placeholder" \
    CLOUD_STORAGE_BUCKET="build-placeholder" \
    AWS_ACCESS_KEY_ID="build-placeholder" \
    AWS_SECRET_ACCESS_KEY="build-placeholder" \
    REDIS_URL="redis://localhost:6379" \
    # Disable telemetry in CI/build environments.
    NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ─── Stage 3: Production runner ───────────────────────────────────────────────
FROM node:${NODE_VERSION} AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Non-root user — principle of least privilege.
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Copy only what the runtime needs.
COPY --from=builder /app/public           ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static     ./.next/static

# Ensure the nextjs user owns the working directory.
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

# next start uses standalone output; it doesn't need node_modules.
CMD ["node", "server.js"]
