FROM oven/bun:1 as builder

WORKDIR /app

COPY package.json bun.lockb ./
RUN bun install
COPY . .

FROM oven/bun:1-slim

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/package.json ./
COPY --from=builder /app/.env ./

VOLUME [ "/app/data" ]

EXPOSE 4100
EXPOSE 4101

ENV NODE_ENV=production

CMD ["bun", "src/main.ts"] 
