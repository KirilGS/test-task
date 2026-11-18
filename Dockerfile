FROM node:24-slim AS build

WORKDIR /app

COPY package.json package-lock.json .npmrc ./
COPY packages/core/package.json packages/core/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json

RUN npm ci

COPY packages packages
COPY apps apps
COPY data data
COPY docs docs

RUN npm run build

FROM node:24-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV WEB_DIST_DIR=/app/apps/web/dist
ENV DATA_DIR=/app/data
ENV PORT=3000

COPY package.json package-lock.json .npmrc ./
COPY packages/core/package.json packages/core/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json

RUN npm ci --omit=dev

COPY --from=build /app/packages/core/dist packages/core/dist
COPY --from=build /app/packages/core/prompts packages/core/prompts
COPY --from=build /app/packages/core/package.json packages/core/package.json
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/api/package.json apps/api/package.json
COPY --from=build /app/apps/web/dist apps/web/dist
COPY --from=build /app/data data

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/api/dist/main.js"]
