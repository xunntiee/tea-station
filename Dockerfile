FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM deps AS builder
WORKDIR /app
COPY . .
RUN npm run publish

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3200
ENV SITE_DIR=/app/site
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/site ./site
COPY --from=builder /app/server ./server
EXPOSE 3200
CMD ["node", "./server/index.mjs"]
