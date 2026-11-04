FROM node:24-bookworm-slim AS build
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps ./apps
COPY packages ./packages
RUN npm ci --no-audit --no-fund \
    && npm run build --workspace @mystreetvendor/admin-dashboard

FROM node:24-bookworm-slim AS production
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
WORKDIR /app
# Monorepo tracing retains the apps/admin-dashboard path. Static assets are not
# copied by Next's standalone generator and must accompany the generated server.
COPY --from=build --chown=node:node /app/apps/admin-dashboard/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/admin-dashboard/.next/static ./apps/admin-dashboard/.next/static
USER node
EXPOSE 3000
CMD ["node", "apps/admin-dashboard/server.js"]
