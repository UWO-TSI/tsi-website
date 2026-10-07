# syntax=docker/dockerfile:1
# The multiplayer server (specs/multiplayer.md §1.3). Build context is the REPO ROOT,
# trimmed by the root .dockerignore to realtime/, the shared contract in web/lib/net/ and
# the chat filter in web/lib/moderation/. Deploy:
#   fly deploy . --config realtime/fly.toml --dockerfile realtime/Dockerfile --remote-only

# ── build: install everything, bundle src + @net/* into dist/index.mjs ─────────
FROM node:24-slim AS build
WORKDIR /app/realtime
COPY realtime/package.json realtime/package-lock.json realtime/.npmrc ./
RUN npm ci --no-audit --no-fund
COPY realtime/ ./
# tsconfig maps @net/* to ../web/lib/net/* and @moderation/* to ../web/lib/moderation/*,
# i.e. /app/web/lib/net and /app/web/lib/moderation here (the chat filter, M2).
COPY web/lib/net/ /app/web/lib/net/
COPY web/lib/moderation/ /app/web/lib/moderation/
RUN npm run build

# ── runtime: production dependencies and the bundle, as the unprivileged user ──
FROM node:24-slim
ENV NODE_ENV=production
WORKDIR /app
COPY realtime/package.json realtime/package-lock.json realtime/.npmrc ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/realtime/dist ./dist
USER node
EXPOSE 2567
CMD ["node", "--enable-source-maps", "dist/index.mjs"]
