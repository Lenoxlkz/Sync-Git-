# GitHub Orbit Next — build multi-stage para Render (uso exclusivo personal)
# Etapa 1: build estático de Next.js
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund 2>/dev/null || npm install --no-audit --no-fund
COPY . .
RUN npm run build

# Etapa 2: nginx sirviendo el export estático + Basic Auth opcional
FROM nginx:1.27-alpine
RUN apk add --no-cache apache2-utils
COPY --from=build /app/out /usr/share/nginx/html
COPY start.sh /orbit-start.sh
RUN chmod +x /orbit-start.sh
EXPOSE 10000
CMD ["/orbit-start.sh"]
