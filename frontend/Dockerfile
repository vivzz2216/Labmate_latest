FROM mirror.gcr.io/library/node:18-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM mirror.gcr.io/library/node:18-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM mirror.gcr.io/library/node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy necessary files from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Railway sets $PORT (commonly 8080). Next.js standalone server reads process.env.PORT.
# Do NOT hardcode PORT=3000 here.
EXPOSE 8080
ENV HOSTNAME="0.0.0.0"

# Use Next.js production server
CMD ["node", "server.js"]
