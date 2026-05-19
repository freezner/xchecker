FROM node:20-alpine AS base
WORKDIR /app
COPY package.json ./
RUN npm install

# 개발 모드
FROM base AS dev
COPY . .
CMD ["npx", "tsx", "watch", "src/main.ts"]

# 프로덕션 빌드
FROM base AS build
COPY . .
RUN npx tsc

FROM node:20-alpine AS prod
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/src/db/migrations ./dist/db/migrations
CMD ["node", "dist/main.js"]
