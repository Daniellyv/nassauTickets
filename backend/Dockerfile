# Imagem única de produção: API (Express) + frontend buildado (React/Vite).
# O contexto de build é a RAIZ do repositório (precisa enxergar backend/ e frontend/):
#   docker build -f backend/Dockerfile -t nassautickets .
FROM node:22-alpine AS frontend
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM node:22-alpine
ENV NODE_ENV=production \
    FRONTEND_DIST=/app/public
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY backend/ ./
COPY --from=frontend /frontend/dist /app/public
USER node
EXPOSE 3000
# migra o esquema, cria os dados iniciais (idempotente) e sobe a API na $PORT da plataforma
CMD ["npm", "run", "start:prod"]
