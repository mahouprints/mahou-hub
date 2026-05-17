FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/pricing/package.json packages/pricing/
COPY packages/contracts/package.json packages/contracts/
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/pricing/node_modules ./packages/pricing/node_modules
COPY --from=deps /app/packages/contracts/node_modules ./packages/contracts/node_modules
COPY packages/contracts/ packages/contracts/
COPY packages/pricing/ packages/pricing/
COPY apps/api/ apps/api/
RUN pnpm --filter @mahou-hub/contracts build \
 && pnpm --filter @mahou-hub/pricing build \
 && pnpm --filter api exec prisma generate \
 && pnpm --filter api run build

FROM node:22-alpine AS runner
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app

COPY --from=build --chown=app:app /app/apps/api/dist ./dist
COPY --from=build --chown=app:app /app/apps/api/prisma ./prisma
COPY --from=build --chown=app:app /app/apps/api/node_modules ./node_modules
COPY --from=build --chown=app:app /app/packages/pricing/dist ./node_modules/@mahou-hub/pricing/dist
COPY --from=build --chown=app:app /app/packages/pricing/package.json ./node_modules/@mahou-hub/pricing/package.json
COPY --from=build --chown=app:app /app/packages/contracts/dist ./node_modules/@mahou-hub/contracts/dist
COPY --from=build --chown=app:app /app/packages/contracts/package.json ./node_modules/@mahou-hub/contracts/package.json
COPY --from=build --chown=app:app /app/apps/api/package.json ./

USER app
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/main.js"]
