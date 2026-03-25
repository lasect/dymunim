# Dymunim - Postgres-Native Execution Layer

## Overview

Build a system where Postgres acts as durable queue + transactional boundary + system of record, **Cloudflare Dynamic Workers** execute arbitrary code at runtime, and TanStack Start React app serves as visualization/control plane.

---

## Architecture

```
Client (UI) → TanStack Start → SQL API → Postgres → Cloudflare Workers → Dynamic Workers → UI
```

## Tech Stack

- **Database**: Postgres 16 (via tembo/pgmq-pg image)
- **Execution**: Cloudflare Dynamic Workers (LOADER.load / LOADER.get)
- **API**: TanStack Start server functions
- **UI**: TanStack Start + shadcn/ui

---

## How It Works

1. User submits JavaScript code via UI (`/workers/new`)
2. Job stored in Postgres with code + optional cacheId
3. Server calls Cloudflare Worker API:
   - `LOADER.load()` - fresh worker for one-time execution
   - `LOADER.get(id, callback)` - cached warm worker
4. Cloudflare spawns Dynamic Worker in sandbox
5. Result returned and stored in Postgres

---

## Phases

### Phase 1: Infrastructure ✅

- [x] Docker Compose for Postgres 16
- [x] Database migrations (schema, functions, dynamic worker support)
- [x] Jobs state table with code storage

### Phase 2: Cloudflare Dynamic Workers ✅

- [x] Cloudflare Worker with Worker Loader binding
- [x] `/load` endpoint for one-time execution
- [x] `/get` endpoint for cached workers
- [x] API client in web app

### Phase 3: API Layer ✅

- [x] TanStack Start server functions
- [x] executeDynamicWorker - create + execute job
- [x] getJobStatus, listJobs, getMetrics

### Phase 4: UI Layer ✅

- [x] Dashboard (/)
- [x] Jobs list (/jobs)
- [x] Job detail (/jobs/$jobId)
- [x] Dynamic Worker creation (/workers/new)
- [x] Metrics (/metrics)
- [x] Queues (/queues)

---

## Data Model

### Job State

```sql
jobs_state (
  job_id BIGINT PRIMARY KEY,
  job_type TEXT,
  payload JSONB,
  status TEXT,
  result JSONB,
  error TEXT,
  code TEXT,              -- Dynamic worker code
  language TEXT,          -- javascript, python, etc.
  worker_id TEXT,         -- Cache ID for get()
  execution_logs JSONB,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

---

## Getting Started

1. **Deploy Cloudflare Worker:**

   ```bash
   cd cloudflare-worker
   npm install
   wrangler deploy
   ```

2. **Start database:**

   ```bash
   docker-compose up -d
   ```

3. **Configure environment:**

   ```bash
   cp .env.example .env
   # Edit .env and set CLOUDFLARE_WORKER_URL
   ```

4. **Start web UI:**

   ```bash
   cd apps/web && bun run dev
   ```

5. **Open the app:**
   Navigate to http://localhost:3000

---

## Environment Variables

- `DATABASE_URL` - Postgres connection
- `CLOUDFLARE_WORKER_URL` - Your deployed Cloudflare Worker URL

---

## Project Structure

```
dymunim/
├── apps/web/                 # TanStack Start React app
│   ├── src/routes/           # Page routes
│   ├── src/server/           # Server functions
│   └── src/lib/              # Cloudflare client
├── cloudflare-worker/        # Cloudflare Worker with Worker Loader
│   ├── src/index.ts          # Handler code
│   └── wrangler.jsonc        # Worker config
├── packages/db/              # Shared database client
├── packages/ui/              # Shared UI components
└── infrastructure/            # Docker, migrations
    └── postgres/migrations/   # SQL migrations
```

---

## Cloudflare Dynamic Workers

Uses actual Cloudflare Dynamic Workers API:

- **LOADER.load()** - Creates fresh worker, one-time execution
- **LOADER.get(id, callback)** - Caches worker by ID for reuse (warm starts)

Code runs in sandboxed environment with limited globals (Math, JSON, Date, etc.)
