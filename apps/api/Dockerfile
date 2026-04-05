FROM node:22-alpine AS builder
WORKDIR /app

RUN corepack enable pnpm

# Copy workspace files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* turbo.json tsconfig.json ./
COPY packages/ packages/
COPY apps/api/ apps/api/

RUN pnpm install --frozen-lockfile
RUN pnpm turbo build --filter=@resilipath/api

# ─── Production image ───────────────────────────────────────
FROM node:22-alpine
WORKDIR /app

RUN corepack enable pnpm

COPY --from=builder /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml* ./
COPY --from=builder /app/packages/ packages/
COPY --from=builder /app/apps/api/package.json apps/api/
COPY --from=builder /app/apps/api/dist/ apps/api/dist/

RUN pnpm install --frozen-lockfile --prod

EXPOSE 8080
ENV NODE_ENV=production

CMD ["node", "apps/api/dist/index.js"]
