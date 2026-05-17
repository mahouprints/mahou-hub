FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile \
 && pnpm --filter @mahou-hub/contracts build \
 && pnpm --filter @mahou-hub/pricing build \
 && pnpm --filter api exec prisma generate \
 && pnpm --filter api run build \
 && pnpm --filter api deploy --prod /app/deploy

FROM node:22-alpine AS runner
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY --from=build --chown=app:app /app/deploy ./
COPY --from=build --chown=app:app /app/apps/api/dist ./dist
COPY --from=build --chown=app:app /app/apps/api/prisma ./prisma
COPY --from=build --chown=app:app /app/packages/pricing/dist ./node_modules/@mahou-hub/pricing/dist
COPY --from=build --chown=app:app /app/packages/pricing/package.json ./node_modules/@mahou-hub/pricing/package.json
COPY --from=build --chown=app:app /app/packages/contracts/dist ./node_modules/@mahou-hub/contracts/dist
COPY --from=build --chown=app:app /app/packages/contracts/package.json ./node_modules/@mahou-hub/contracts/package.json

RUN chown -R app:app /app && ./node_modules/.bin/prisma generate --schema=./prisma/schema.prisma

USER app
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/src/main.js"]
