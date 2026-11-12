# Build the web app, then run the API server, which also serves web/dist. Pattern copied from hostile-mcp/Dockerfile.
FROM node:22-alpine AS build
RUN apk add --no-cache git
WORKDIR /app
COPY package.json package-lock.json ./
COPY web/package.json web/
COPY server/package.json server/
RUN npm ci
COPY web web
RUN npm run build -w web

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production GALLERY_PORT=5181
COPY package.json package-lock.json ./
COPY web/package.json web/
COPY server/package.json server/
RUN npm ci --omit=dev -w server && npm cache clean --force
COPY server/src server/src
COPY --from=build /app/web/dist web/dist
USER node
EXPOSE 5181
# Inside the container the server must listen on all interfaces, so GALLERY_BIND is set here on purpose.
# The compose file publishes the port on 127.0.0.1 only; do not publish it more widely.
ENV GALLERY_HOST=0.0.0.0 GALLERY_BIND=1
CMD ["node", "server/src/index.js"]
