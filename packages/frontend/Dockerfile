FROM node:20-alpine AS base
WORKDIR /app
COPY package.json ./
RUN npm install

# 개발 모드
FROM base AS dev
COPY . .
CMD ["npx", "vite", "--host"]

# 프로덕션 빌드
FROM base AS build
ARG VITE_API_URL
ARG VITE_WS_URL
COPY . .
RUN npx vite build

FROM base AS prod
COPY --from=build /app/dist ./dist
COPY --from=build /app/vite.config.ts ./vite.config.ts
CMD ["npx", "vite", "preview", "--host", "0.0.0.0", "--port", "3000"]
