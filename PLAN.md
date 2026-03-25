# Dymunim - Postgres-Native Execution Layer

## Overview

Build a system where Postgres (via PGMQ) acts as durable queue + transactional boundary + system of record, Dynamic Workers act as execution runtime, and TanStack Start React app serves as visualization/control plane.

---

## Architecture

```
Client (UI) → TanStack Start → SQL API → PGMQ → Dispatcher → Workers → Postgres → UI
```

## Tech Stack

- **Database**: Postgres 16 + PGMQ
- **Workers**: Bun runtime
- **API**: TanStack Start server functions
- **Real-time**: WebSocket
- **UI**: TanStack Start + shadcn/ui

---

## Phases

### Phase 1: Infrastructure & Database
- [x] Docker Compose for Postgres 16 + PGMQ
- [ ] Database migrations and SQL functions
- [ ] Jobs registry and state tables
- [ ] Queue setup

### Phase 2: Worker System
- [ ] Worker framework (Bun)
- [ ] Job handlers (demo jobs)
- [ ] WebSocket server for real-time
- [ ] Auto-scaling logic

### Phase 3: API Layer
- [ ] TanStack Start server functions
- [ ] enqueue, status, retry, list, metrics

### Phase 4: UI Layer
- [ ] Jobs list page (/jobs)
- [ ] Job detail page (/jobs/:id)
- [ ] Workers page (/workers)
- [ ] Metrics page (/metrics)
- [ ] Queue page (/queues)

### Phase 5: Polish & Demo
- [ ] Chaos mode (random failures/timeouts)
- [ ] Demo controls (spawn jobs)
- [ ] Visual polish (animations, dark mode)

---

## Job Types (Demo)

1. **Number Crunching**: prime_sieve, fibonacci, monte_carlo
2. **Data Processing**: json_transform, csv_parse, sort_benchmark
3. **Text/Analysis**: word_count, keyword_extract, hash_data
4. **Simulation**: game_of_life (visually interesting output)
5. **Chaos**: random_fail, random_timeout (for retry demo)

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

---

## SQL Functions

- `enqueue(job_type, payload, priority?)` - add job to queue
- `status(job_id)` - get job status + result
- `retry(job_id)` - re-queue failed job
- `list_jobs(filters)` - query jobs with pagination
- `get_metrics()` - aggregate stats

---

## Dependencies

All configurable via env:
- DATABASE_URL (Postgres connection)
- Worker count (auto-scale)
- Polling interval
- WebSocket port