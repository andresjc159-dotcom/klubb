# ---------- Build web-staff ----------
FROM node:20-slim AS staff-build
WORKDIR /app
COPY apps/web-staff/package.json ./
RUN npm install
COPY apps/web-staff/ .
RUN npm run build

# ---------- Build cliente-pwa ----------
FROM node:20-slim AS client-build
WORKDIR /app
COPY apps/cliente-pwa/package.json ./
RUN npm install
COPY apps/cliente-pwa/ .
RUN npm run build

# ---------- Serve with nginx ----------
FROM nginx:alpine
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=client-build /app/dist /usr/share/nginx/html/
COPY --from=staff-build /app/dist /usr/share/nginx/html/staff/
