# ---------- Build frontends ----------
FROM node:20-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web-staff/package.json apps/web-staff/
COPY apps/cliente-pwa/package.json apps/cliente-pwa/
RUN npm ci --workspace=web-staff --workspace=cliente-pwa

COPY . .
RUN npm run build -w web-staff
RUN npm run build -w cliente-pwa

# ---------- Serve with nginx ----------
FROM nginx:alpine
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/cliente-pwa/dist /usr/share/nginx/html/
COPY --from=build /app/apps/web-staff/dist /usr/share/nginx/html/staff/
