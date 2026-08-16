# syntax=docker/dockerfile:1

# --- Build stage ---
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- Runtime stage ---
# nginx sirve el SPA estático y proxya /api al backend. El archivo nginx.conf
# se copia como template: el entrypoint oficial de la imagen ejecuta envsubst
# sobre $BACKEND_UPSTREAM (ver nginx.conf).
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/templates/default.conf.template
ENV BACKEND_UPSTREAM=backend:8080
EXPOSE 80
