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

# schema.prisma declares `datasource db` WITHOUT a `url` — the connection string
# comes from prisma.config.ts. Without this file in the runtime image,
# `prisma migrate deploy` aborts with:
#   "The datasource.url property is required in your Prisma config file"
# and the container never reaches `node dist/index.js`.
COPY prisma.config.ts ./

# `prisma` CLI is a devDependency (not in the --only=production install above),
# but is needed at container start to run `prisma migrate deploy`. Pull just
# the prisma package + its bin from the full build-stage install rather than
# shipping all devDependencies in the runtime image.
COPY --from=build /app/node_modules/prisma ./node_modules/prisma
COPY --from=build /app/node_modules/.bin/prisma ./node_modules/.bin/prisma

# Prisma 7's @prisma/client has no postinstall generate step, so the deps stage
# (`npm ci --only=production`) never produces node_modules/.prisma/client.
# Without this the server crashes on boot with
#   "Cannot find module '.prisma/client/default'".
# Copy the client generated in the build stage instead.
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma

EXPOSE 4000

# Health check — relies on the GET /health endpoint defined in src/index.ts
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

# MED-12 fix: run pending migrations before starting the server. Previously
# there was no migration step in the deploy path at all (schema drift risk
# on every deploy) despite a comment implying one existed.
CMD ["sh", "-c", "npx prisma migrate deploy --schema=src/prisma/schema.prisma && node dist/index.js"]
