# ---- Base ----
FROM node:20-alpine AS base
RUN apk add --no-cache openssl
WORKDIR /app

# ---- Dependencies ----
FROM base AS deps
COPY package.json package-lock.json* ./
COPY prisma ./prisma/
RUN npm ci --legacy-peer-deps

# ---- Build ----
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build Next.js
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- Production ----
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built assets
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
# Ensure instrumentation hook is included (cron scheduler)
COPY --from=builder /app/.next/server/instrumentation* ./.next/server/
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/nodemailer ./node_modules/nodemailer
COPY --from=builder /app/node_modules/@the-convocation ./node_modules/@the-convocation
COPY --from=builder /app/node_modules/@sinclair ./node_modules/@sinclair
COPY --from=builder /app/node_modules/otpauth ./node_modules/otpauth
COPY --from=builder /app/node_modules/tough-cookie ./node_modules/tough-cookie
COPY --from=builder /app/node_modules/set-cookie-parser ./node_modules/set-cookie-parser
COPY --from=builder /app/node_modules/linkedom ./node_modules/linkedom
COPY --from=builder /app/node_modules/cross-fetch ./node_modules/cross-fetch
COPY --from=builder /app/node_modules/headers-polyfill ./node_modules/headers-polyfill
COPY --from=builder /app/node_modules/json-stable-stringify ./node_modules/json-stable-stringify
COPY --from=builder /app/node_modules/x-client-transaction-id ./node_modules/x-client-transaction-id

# Create cache directory with proper permissions
RUN mkdir -p .next/cache && chown -R nextjs:nodejs .next

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
