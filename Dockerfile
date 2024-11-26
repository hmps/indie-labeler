FROM node:23-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
COPY . /app
WORKDIR /app

FROM base AS prod-deps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

FROM base AS build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm run build

FROM base
COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=build /app/build /app/build

RUN mkdir -p /app/data && chown -R node:node /app/data

ENV DB_PATH=/app/data/labels.db
ENV CURSOR_PATH=/app/data/cursor.txt
ENV NODE_ENV=production

VOLUME [ "/app/data" ]
EXPOSE 3000/tcp

USER node

CMD ["pnpm", "start"]
