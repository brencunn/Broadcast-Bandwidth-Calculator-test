FROM node:20-bullseye-slim AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install

FROM node:20-bullseye-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Ensure public exists even when the repo has no public assets.
RUN mkdir -p /app/public
ENV NODE_ENV=production
RUN npm run build
RUN npm prune --omit=dev

FROM node:20-bullseye-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV EVENT_DATA_DIR=/data/events
RUN mkdir -p /data/events
VOLUME ["/data/events"]
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
EXPOSE 3000
CMD ["npm","run","start","--","-H","0.0.0.0","-p","3000"]
