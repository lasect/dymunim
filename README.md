# Dymunim

Postgres-backed job queue with Cloudflare Dynamic Workers for code execution.

## Stack

- **Database**: Postgres 16 + PGMQ
- **Execution**: Cloudflare Dynamic Workers (LOADER.load / LOADER.get)
- **API**: TanStack Start server functions
- **UI**: TanStack Start + shadcn/ui

## Architecture

```
UI → Postgres (job storage) → Server Functions → Cloudflare Worker → Dynamic Workers
```

Jobs store JavaScript code in Postgres. Server calls Cloudflare to spawn dynamic workers that execute the code in a sandbox.

## Quick Start

1. Deploy Cloudflare Worker:

   ```bash
   cd cloudflare-worker
   npm install
   wrangler deploy
   ```

2. Copy `.env.example` to `.env` and set `CLOUDFLARE_WORKER_URL`

3. Start database and UI:

   ```bash
   docker-compose up -d
   cd apps/web && bun run dev
   ```

4. Open http://localhost:3000

## Environment Variables

- `DATABASE_URL` - Postgres connection
- `CLOUDFLARE_WORKER_URL` - Deployed Cloudflare Worker URL

## Key Files

- `cloudflare-worker/src/index.ts` - Worker Loader implementation
- `apps/web/src/server/functions.ts` - Job API
- `apps/web/src/routes/workers.new.tsx` - Dynamic worker UI
- `infrastructure/postgres/migrations/` - Database schema
