# Build frontend + run API (serves SPA)
FROM node:20-bookworm-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
ARG VITE_API_URL=
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM node:20-bookworm-slim AS backend-deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package-lock.json ./backend/
COPY scripts ./scripts
COPY database ./database
RUN npm ci --omit=dev && npm ci --omit=dev --prefix backend

FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=backend-deps /app /app
COPY backend ./backend
COPY scripts ./scripts
COPY database ./database
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

WORKDIR /app/backend
EXPOSE 3001
CMD ["sh", "-c", "node ../scripts/migrate.js && node src/server.js"]
