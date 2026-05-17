FROM node:22-slim AS build
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile \
 && pnpm --filter @mahou-hub/contracts build \
 && pnpm --filter @mahou-hub/pricing build \
 && pnpm --filter api exec prisma generate \
 && pnpm --filter api run build \
 && pnpm --filter api deploy --prod /app/deploy

FROM node:22-slim AS runner
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/* \
 && addgroup --system app && adduser --system --ingroup app app
WORKDIR /app
COPY --from=build --chown=app:app /app/deploy ./
COPY --from=build --chown=app:app /app/apps/api/dist ./dist
COPY --from=build --chown=app:app /app/apps/api/prisma ./prisma
COPY --from=build --chown=app:app /app/packages/pricing/dist ./node_modules/@mahou-hub/pricing/dist
COPY --from=build --chown=app:app /app/packages/pricing/package.json ./node_modules/@mahou-hub/pricing/package.json
COPY --from=build --chown=app:app /app/packages/contracts/dist ./node_modules/@mahou-hub/contracts/dist
COPY --from=build --chown=app:app /app/packages/contracts/package.json ./node_modules/@mahou-hub/contracts/package.json

RUN npm install -g prisma@5.22.0 tsx@4.19.1 \
 && prisma generate --schema=./prisma/schema.prisma \
 && chown -R app:app /app

USER app
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/src/main.js"]
