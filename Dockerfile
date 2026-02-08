ARG NODE_VERSION=20.11.1
ARG PG_VERSION=17

FROM node:${NODE_VERSION}-alpine AS build

ENV NPM_CONFIG_UPDATE_NOTIFIER=false
ENV NPM_CONFIG_FUND=false

WORKDIR /app

COPY package*.json tsconfig.json ./
COPY src ./src

RUN npm ci && \
  npm run build && \
  npm prune --production

# Runtime: postgres:17-alpine já traz pg_dump 17; instalamos só Node
FROM postgres:${PG_VERSION}-alpine

RUN apk add --no-cache nodejs npm

WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./
COPY public ./public

CMD ["/bin/sh", "-c", "pg_isready --dbname=$BACKUP_DATABASE_URL && pg_dump --version && node dist/index.js"]
