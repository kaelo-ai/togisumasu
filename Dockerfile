# Togisumasu — zero-dependency Node app (built-in http, crypto, sqlite)
FROM node:22-alpine

ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/data

WORKDIR /app
COPY package.json server.js ai.js questions.js admin.js ./
COPY public ./public

# Run as the unprivileged "node" user that ships with the image
RUN mkdir -p /data && chown -R node:node /data /app
USER node

VOLUME ["/data"]
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/api/health >/dev/null || exit 1

CMD ["node", "--no-warnings=ExperimentalWarning", "server.js"]
