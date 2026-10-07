# ==============================================================================
# Nástěnka – Produkční Dockerfile pro Synology Container Manager
# ==============================================================================
# Technologie: Next.js 16 (App Router), React 19, Node.js 20 LTS (Alpine)
# Architektura: Multi-stage build s minimálními produkčními závislostmi
# Běh: Produkční 'npm run build' a následně 'npm run start' pod non-root uživatelem
# ==============================================================================

# 1. Základní Node.js prostředí
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

# 2. Závislosti pro sestavení (včetně devDependencies pro Next.js/Tailwind/TypeScript)
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# 3. Sestavení produkční Next.js aplikace
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Hermetický build bez nutnosti živé databáze nebo lokálních secrets
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# 4. Čisté produkční závislosti bez vývojových nástrojů
FROM base AS prod-deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# 5. Finální produkční runtime
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Bezpečnost: Vytvoření neprivilegovaného systémového uživatele pro běh aplikace
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Kopírování pouze nutných produkčních artefaktů
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=prod-deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/database/migrations ./database/migrations

USER nextjs

EXPOSE 3000

# Ověření běhu aplikace pro Synology Container Manager (liveness probe)
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/api/health || exit 1

CMD ["npm", "run", "start"]
