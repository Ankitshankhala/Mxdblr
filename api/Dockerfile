# =============================================================================
# MXDBLR API — Multi-stage Dockerfile
# Stage 1 (deps):  install production dependencies only
# Stage 2 (build): install all deps, generate Prisma client, compile TypeScript
# Stage 3 (runner): lean production image — no dev tooling, no source files
# =============================================================================

FROM node:20-alpine AS base
WORKDIR /app

# ── Stage 1: production dependencies only ────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --only=production

# ── Stage 2: full build ───────────────────────────────────────────────────────
FROM base AS build
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Generate Prisma client before TypeScript compilation
RUN npx prisma generate --schema=src/prisma/schema.prisma
RUN npm run build

# ── Stage 3: lean runner ──────────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app

# Copy only what the running server needs
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
# Prisma schema + migrations needed for `prisma migrate deploy` at startup
COPY --from=build /app/src/prisma ./src/prisma
COPY package.json ./

EXPOSE 4000

# Health check — relies on the GET /health endpoint defined in src/index.ts
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["node", "dist/index.js"]
