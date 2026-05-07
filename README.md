# Trackam

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new?template=https://github.com/jeffreyon/trackam)

Trackam is a logistics management tool for Nigerian small businesses that dispatch goods via bike, tricycle, van, or truck riders. It gives operators a single dashboard to dispatch shipments, track costs in real time, monitor riders, and catch "ghosting" — when a rider goes silent and the goods disappear.

## What it does

**Dispatch & tracking**
- Create shipments with goods description, pickup/delivery locations, distance, rider assignment, and optional recipient contact
- Track each shipment through its lifecycle: `pending → in_transit → delivered` (or `failed` / `ghosted`)
- Manual status updates with optional notes; full timeline log per shipment

**Cost accounting**
- Auto-calculates fuel cost at dispatch using configurable fuel price (₦/litre) and efficiency multiplier
- Tracks rider fee, fuel cost, and total logistics cost per shipment in kobo
- Dashboard shows monthly total spend, cost breakdown charts, and value-at-risk for active shipments

**Ghosting & delay detection**
- Flags shipments as "delayed" when past expected delivery date
- Flags shipments as "ghosting risk" when no status update in configurable hours (default 48h)
- `ghosted` status records total loss: goods value + logistics spend
- Recover a ghosted shipment back to `in_transit` if the rider resurfaces

**Risk scoring**
- Each shipment gets a risk score (low / medium / high) based on route distance, vehicle-distance mismatch, and rider ghost rate
- Score breakdown shown on shipment detail page

**Rider management**
- Register riders with vehicle type, city coverage, and base fee
- Ghost rate and total shipments tracked automatically
- Deactivate riders without losing history

**Routes**
- Save frequently used routes with default rider and fee
- Quick Dispatch pre-fills from a saved route

**Settings**
- Per-account fuel price, efficiency multiplier, and ghosting threshold
- Business name and city stored for display

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, TypeScript, React Router, Tailwind CSS, shadcn/ui |
| Backend | Node.js, Express 5, raw SQL via `pg` |
| Database | PostgreSQL |
| Auth | JWT + HTTP-only session cookies |
| Container | Docker (separate images for frontend and backend) |

**Frontend runtime config** — the frontend image writes `window.__APP_CONFIG__` at container start via `scripts/writeRuntimeConfig.mjs`, so `VITE_API_URL` is injected at runtime rather than baked into the build. This means one Docker image works across environments.

## Local setup

### Prerequisites

- Node.js 20+
- PostgreSQL running locally (default: `postgres://postgres@127.0.0.1:6429/trackam`)

### Backend

```bash
cd backend
cp .env.example .env          # edit DATABASE_URL, JWT_SECRET etc. as needed
npm install
npm run db:init               # creates the database if it doesn't exist
npm run db:migrate            # runs all migrations in order
npm run db:seed               # seeds two local demo accounts
npm run dev                   # starts on PORT from .env (default 4429)
```

Demo accounts after seed:
- Admin: `admin@example.com` / `password123`
- User: `user@example.com` / `password123`

To also seed demo shipment data:
```bash
npm run db:seed:demo
npm run db:seed:logistics     # riders, routes, and shipments
```

### Frontend

```bash
cd frontend
cp .env.local.example .env.local    # set VITE_API_URL=http://127.0.0.1:4429
npm install
npm run dev                         # starts on port 3429 by default
```

## Environment variables

### Backend (`.env`)

| Variable | Description | Default |
|---|---|---|
| `PORT` | Server port | `4429` |
| `FRONTEND_URL` | CORS allowed origin | `http://127.0.0.1:3429` |
| `DATABASE_URL` | PostgreSQL connection string | — |
| `JWT_SECRET` | Signing secret for JWT tokens | — |
| `JWT_EXPIRATION_SECONDS` | Token lifetime | `3600` |
| `SESSION_COOKIE_NAME` | Cookie name | `trackam_session` |
| `SESSION_COOKIE_MAX_AGE_DAYS` | Cookie max age | `7` |
| `SESSION_COOKIE_SECURE` | Require HTTPS for cookie | `false` (true in prod) |
| `BOOTSTRAP_ADMIN_EMAIL` | Seed admin email | — |
| `BOOTSTRAP_ADMIN_PASSWORD` | Seed admin password | — |
| `STORAGE_DIRECTORY` | File upload directory | `storage` |
| `STORAGE_URL_PREFIX` | Public URL prefix for uploads | — |

### Frontend (`.env.local`)

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend base URL (used at dev time; overridden at runtime in Docker) |

## Deployment (Railway)

Railway deploys the frontend and backend as two separate services, both from the same repository, with a managed PostgreSQL database.

### Services to create

1. **PostgreSQL** — add the Railway Postgres plugin; note the `DATABASE_URL`
2. **Backend** — point to `/backend`, Dockerfile build; set all backend env vars
3. **Frontend** — point to `/frontend`, Dockerfile build; set `VITE_API_URL` to the backend's Railway public URL

### Backend env vars to set in Railway

```
DATABASE_URL=<from Railway Postgres>
JWT_SECRET=<generate a strong random string>
JWT_EXPIRATION_SECONDS=3600
FRONTEND_URL=https://<your-frontend>.up.railway.app
SESSION_COOKIE_SECURE=true
SESSION_COOKIE_DOMAIN=
BOOTSTRAP_ADMIN_EMAIL=<your admin email>
BOOTSTRAP_ADMIN_PASSWORD=<strong password>
STORAGE_DIRECTORY=storage
STORAGE_URL_PREFIX=https://<your-backend>.up.railway.app/storage
PORT=8080
```

### Run migrations on first deploy

In the Railway backend service shell (or as a deploy command):

```bash
npm run db:migrate
npm run db:seed:bootstrap-admin
```

### Frontend env var

```
VITE_API_URL=https://<your-backend>.up.railway.app
PORT=3000
```

The frontend Docker image reads `VITE_API_URL` at container start and writes it into `dist/runtime-config.js`, so it doesn't need a rebuild when the backend URL changes.

## Database schema

Core tables (created by migrations in `backend/migrations/`):

- `users` — accounts with roles
- `riders` — rider profiles with vehicle type and ghost rate
- `routes` — saved pickup-to-delivery routes
- `shipments` — each dispatch with cost, status, risk score, and flags
- `shipment_status_log` — full audit trail of status changes
- `logistics_settings` — per-user key/value config (fuel price, efficiency, ghost threshold)

## Project structure

```
trackam/
  backend/
    migrations/       SQL migrations (run in order via migrate.js)
    scripts/          DB init, migrate, seed scripts
    src/
      app/            Feature modules: riders, routes, shipments, dashboard, settings
      core/           DB client, auth middleware, error handling
    server.js         Entry point
  frontend/
    src/
      pages/          Page components (Dashboard, Shipments, Riders, Routes, Settings)
      components/     Shared UI components
      services/       API client modules (logistics.ts, etc.)
      lib/            Formatting utilities, API client
    scripts/          Runtime config injection
```
