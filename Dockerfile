FROM oven/bun:1.4.2 AS frontend-deps
WORKDIR /app/frontend
COPY frontend/package.json frontend/bun.lock* ./
RUN bun install --frozen-lockfile

FROM frontend-deps AS frontend-build
COPY frontend/ ./
ENV NODE_OPTIONS="--max-old-space-size=384"
RUN bun run build

FROM oven/bun:1.4.2
WORKDIR /app

COPY backend/package.json backend/bun.lock* ./backend/
RUN cd backend && bun install --production

COPY backend/ ./backend/
COPY scripts/ ./scripts/
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

RUN mkdir -p /app/data

ENV HOST=0.0.0.0 \
    PORT=5555 \
    DB_PATH=/app/data/world.sqlite

EXPOSE 5555
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD bun --eval "const r=await fetch('http://localhost:5555/api/v1/auth/session');process.exit(r.ok?0:1)"
USER bun
CMD ["bun", "--cwd", "backend", "src/server.ts"]
