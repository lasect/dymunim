-- Create jobs registry table
CREATE TABLE IF NOT EXISTS jobs_registry (
    job_type TEXT PRIMARY KEY,
    handler TEXT NOT NULL,
    timeout_seconds INT DEFAULT 30,
    max_retries INT DEFAULT 3,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create jobs state table
CREATE TABLE IF NOT EXISTS jobs_state (
    job_id BIGSERIAL PRIMARY KEY,
    job_type TEXT NOT NULL,
    payload JSONB DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'pending',
    result JSONB,
    error TEXT,
    priority INT DEFAULT 0,
    attempts INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_jobs_state_status ON jobs_state(status);
CREATE INDEX IF NOT EXISTS idx_jobs_state_job_type ON jobs_state(job_type);
CREATE INDEX IF NOT EXISTS idx_jobs_state_created_at ON jobs_state(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_state_updated_at ON jobs_state(updated_at DESC);

-- Create workers table
CREATE TABLE IF NOT EXISTS workers (
    worker_id TEXT PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'idle',
    current_job_id BIGINT,
    jobs_processed INT DEFAULT 0,
    started_at TIMESTAMP DEFAULT NOW(),
    last_heartbeat TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workers_status ON workers(status);
CREATE INDEX IF NOT EXISTS idx_workers_last_heartbeat ON workers(last_heartbeat);

-- Create metrics table
CREATE TABLE IF NOT EXISTS job_metrics (
    id BIGSERIAL PRIMARY KEY,
    recorded_at TIMESTAMP DEFAULT NOW(),
    jobs_total INT DEFAULT 0,
    jobs_completed INT DEFAULT 0,
    jobs_failed INT DEFAULT 0,
    jobs_pending INT DEFAULT 0,
    jobs_running INT DEFAULT 0,
    avg_duration_ms NUMERIC,
    workers_active INT DEFAULT 0
);

-- Note: PGMQ extension and queue creation moved to 03-seed.sql
-- to ensure extension is created after schema is ready