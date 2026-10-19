# Jev Cards: the built page and its API in one Node process.
# Leaderboards live in /data: mount a volume there so they survive deploys. Live matches are in memory, so a deploy
# ends the ones in progress (check /api/health for liveMatches first).

FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production \
    DATA_DIR=/data \
    STATIC_DIR=dist \
    PORT=3000
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY server ./server
COPY shared ./shared
COPY cards/lib.ts ./cards/lib.ts
COPY assets/fonts ./assets/fonts
EXPOSE 3000
CMD ["node", "server/main.ts"]
