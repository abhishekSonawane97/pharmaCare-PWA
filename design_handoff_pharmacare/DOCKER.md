# Docker Setup

Self-hosted deployment using Docker Compose. Three services: `web` (Next.js), `api` (Express + cron), `mongo` (MongoDB 7).

---

## File structure

```
pharmacare/
├── apps/
│   ├── web/                  ← Next.js
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   ├── next.config.js
│   │   └── ...
│   └── api/                  ← Express
│       ├── Dockerfile
│       ├── package.json
│       └── ...
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## `docker-compose.yml`

```yaml
version: '3.9'

services:
  mongo:
    image: mongo:7
    restart: unless-stopped
    volumes:
      - mongo_data:/data/db
    environment:
      MONGO_INITDB_ROOT_USERNAME: ${MONGO_USER}
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_PASSWORD}
    ports:
      - "27017:27017"
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 5

  api:
    build:
      context: ./apps/api
      dockerfile: Dockerfile
    restart: unless-stopped
    depends_on:
      mongo:
        condition: service_healthy
    environment:
      NODE_ENV: production
      PORT: 4000
      MONGO_URI: mongodb://${MONGO_USER}:${MONGO_PASSWORD}@mongo:27017/pharmacare?authSource=admin
      JWT_ACCESS_SECRET: ${JWT_ACCESS_SECRET}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
      JWT_ACCESS_TTL: 15m
      JWT_REFRESH_TTL: 7d
      WHATSAPP_API_MOCK: ${WHATSAPP_API_MOCK:-true}
      WHATSAPP_ACCESS_TOKEN: ${WHATSAPP_ACCESS_TOKEN:-}
      WHATSAPP_PHONE_NUMBER_ID: ${WHATSAPP_PHONE_NUMBER_ID:-}
      WHATSAPP_BUSINESS_ACCOUNT_ID: ${WHATSAPP_BUSINESS_ACCOUNT_ID:-}
      WHATSAPP_API_VERSION: v21.0
      CORS_ORIGIN: http://localhost:3000
      TZ: Asia/Kolkata
    ports:
      - "4000:4000"

  web:
    build:
      context: ./apps/web
      dockerfile: Dockerfile
    restart: unless-stopped
    depends_on:
      - api
    environment:
      NODE_ENV: production
      NEXT_PUBLIC_API_URL: http://localhost:4000/api
    ports:
      - "3000:3000"

volumes:
  mongo_data:
```

---

## `apps/api/Dockerfile`

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
EXPOSE 4000
CMD ["node", "dist/index.js"]
```

---

## `apps/web/Dockerfile`

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
EXPOSE 3000
CMD ["npm", "start"]
```

For Next.js standalone output (smaller image), set `output: 'standalone'` in `next.config.js` and copy `.next/standalone` instead.

---

## `.env.example`

```env
# MongoDB credentials
MONGO_USER=pharmacare
MONGO_PASSWORD=changeme_strong_password

# JWT secrets — generate with: openssl rand -base64 64
JWT_ACCESS_SECRET=replace_with_random_64_byte_string
JWT_REFRESH_SECRET=replace_with_different_random_64_byte_string

# WhatsApp Business API — mock initially (see WHATSAPP_SETUP.md)
WHATSAPP_API_MOCK=true
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_BUSINESS_ACCOUNT_ID=
```

---

## Run commands

```bash
# First-time setup
cp .env.example .env           # then edit .env with your secrets
docker compose build
docker compose up -d
docker compose exec api npm run seed       # bootstrap admin + sample data
docker compose logs -f                     # tail logs

# Day-to-day
docker compose up -d                        # start
docker compose down                         # stop
docker compose restart api                  # restart one service
docker compose exec mongo mongosh           # open mongo shell
```

Open `http://localhost:3000` in your browser.

---

## Backups

Add a backup cron on the host:

```bash
# /etc/cron.d/pharmacare-backup
0 2 * * * root docker compose -f /opt/pharmacare/docker-compose.yml exec -T mongo mongodump --archive --gzip > /backup/pharmacare-$(date +\%F).gz
```

Keep 30 days of rolling backups. Test restore quarterly.

---

## Production hardening checklist

- [ ] Generate strong JWT secrets (`openssl rand -base64 64`)
- [ ] Use a reverse proxy (Caddy / Nginx) with HTTPS — Caddy is simplest
- [ ] Set firewall to only expose 80/443; block 3000, 4000, 27017 from outside
- [ ] Enable MongoDB auth (already via `MONGO_INITDB_ROOT_*`)
- [ ] Set up off-machine backups (rsync to another host, or S3)
- [ ] Set log rotation on Docker daemon (`/etc/docker/daemon.json` with `log-opts`)
- [ ] Set `TZ=Asia/Kolkata` (or your local) on the api service so cron fires at the right local time
- [ ] Monitor disk space on the mongo volume
