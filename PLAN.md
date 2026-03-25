# Dymunim - Postgres-Native Execution Layer

## Overview

Build a system where Postgres (via PGMQ) acts as durable queue + transactional boundary + system of record, Dynamic Workers act as execution runtime, and TanStack Start React app serves as visualization/control plane.

---

## Architecture

```
Client (UI) → TanStack Start → SQL API → PGMQ → Dispatcher → Workers → Postgres → UI
```

## Tech Stack

- **Database**: Postgres 16 + PGMQ (via tembo/pgmq-pg image)
- **Workers**: Bun runtime
- **API**: TanStack Start server functions
- **Real-time**: WebSocket
- **UI**: TanStack Start + shadcn/ui

---

## Phases

### Phase 1: Infrastructure & Database ✅

- [x] Docker Compose for Postgres 16 + PGMQ
- [x] Database migrations and SQL functions
- [x] Jobs registry and state tables
- [x] Queue setup with seed data

### Phase 2: Worker System ✅

- [x] Worker framework (Bun)
- [x] Job handlers (demo jobs)
- [x] WebSocket server for real-time
- [ ] Auto-scaling logic (deferred)

### Phase 3: API Layer ✅

- [x] TanStack Start server functions
- [x] enqueue, status, retry, list, metrics

### Phase 4: UI Layer ✅

- [x] Dashboard page (/) with overview
- [x] Jobs list page (/jobs) with filtering
- [x] Job detail page (/jobs/$jobId) with retry
- [x] New job page (/jobs/new) with form
- [x] Workers page (/workers) with real-time status
- [x] Metrics page (/metrics) with statistics
- [x] Queue page (/queues) with monitoring
- [x] Demo page (/demo) with batch controls

### Phase 5: Polish & Demo ✅

- [x] Chaos mode (random failures/timeouts)
- [x] Demo controls (spawn jobs)
- [x] WebSocket real-time updates
- [ ] Visual polish (animations, dark mode) - basic styling done

---

## Job Types (Demo)

1. **Number Crunching**: prime_sieve, fibonacci, monte_carlo
2. **Data Processing**: json_transform, sort_benchmark, hash_data
3. **Text/Analysis**: word_count
4. **Simulation**: game_of_life (visually interesting output)
5. **Chaos**: random_fail, random_timeout, chaos_mode (for retry demo)

---

## Data Model

### Job Registry

```sql
jobs_registry (
  job_type TEXT PRIMARY KEY,
  handler TEXT,
  timeout_seconds INT,
  max_retries INT
)
```

### Job State

```sql
jobs_state (
  job_id BIGINT,
  status TEXT,
  result JSONB,
  error TEXT,
  updated_at TIMESTAMP
)
```

### Workers

```sql
workers (
  worker_id TEXT PRIMARY KEY,
  status TEXT,
  current_job_id BIGINT,
  jobs_processed INT,
  started_at TIMESTAMP,
  last_heartbeat TIMESTAMP
)
```

---

## SQL Functions

- `enqueue(job_type, payload, priority?)` - add job to queue
- `get_job_status(job_id)` - get job status + result
- `retry_job(job_id)` - re-queue failed job
- `list_jobs(status?, job_type?, limit?, offset?)` - query jobs with pagination
- `get_metrics()` - aggregate stats
- `register_job(...)` - register job type
- `update_job_status(...)` - update job state

---

## Getting Started

1. **Start the database:**

   ```bash
   docker-compose up -d
   ```

2. **Start the web UI:**

   ```bash
   cd apps/web && bun run dev
   ```

3. **Start a worker:**

   ```bash
   cd workers && bun run start
   ```

4. **Open the app:**
   Navigate to http://localhost:3000

---

## Dependencies

All configurable via env:

- `DATABASE_URL` (Postgres connection)
- `WS_PORT` (WebSocket port, default: 3001)
- Worker count (manual scaling for now)
- Polling interval

---

## Project Structure

```
dymunim/
├── apps/web/                 # TanStack Start React app
│   ├── src/routes/          # Page routes
│   ├── src/server/          # Server functions
│   └── src/hooks/           # React hooks (WebSocket)
├── workers/                 # Bun worker runtime
│   └── src/handlers/        # Job handlers
├── packages/db/             # Shared database client
├── packages/ui/             # Shared UI components
└── infrastructure/          # Docker, migrations
    └── postgres/migrations/ # SQL migrations
```
