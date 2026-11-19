# Multi-stage build for the NestJS API
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache tini && addgroup -S stellaraid && adduser -S -G stellaraid stellaraid
COPY --from=deps --chown=stellaraid:stellaraid /app/node_modules ./node_modules
COPY --chown=stellaraid:stellaraid package.json package-lock.json ./
COPY --from=build --chown=stellaraid:stellaraid /app/dist ./dist
USER stellaraid
EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main"]
