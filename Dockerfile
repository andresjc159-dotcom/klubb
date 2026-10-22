# ---------- Build ----------
FROM node:20-slim AS build
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web-staff/package.json apps/web-staff/
COPY apps/cliente-pwa/package.json apps/cliente-pwa/
RUN npm install

COPY . .
RUN cd apps/api && npx prisma generate
RUN npm run build -w apps/api

# ---------- Runtime ----------
FROM node:20-slim
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app /app
WORKDIR /app/apps/api
ENV NODE_ENV=production
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
