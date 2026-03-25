-- Enable PGMQ extension
CREATE EXTENSION IF NOT EXISTS pgmq;

-- Create the job queue
SELECT pgmq.create('dymunim_jobs');

-- Register all demo job types
INSERT INTO jobs_registry (job_type, handler, timeout_seconds, max_retries) VALUES
    ('prime_sieve', 'compute', 30, 3),
    ('fibonacci', 'compute', 30, 3),
    ('monte_carlo', 'compute', 60, 3),
    ('sleep', 'compute', 300, 3),
    ('random_fail', 'chaos', 10, 5),
    ('random_timeout', 'chaos', 10, 5),
    ('chaos_mode', 'chaos', 60, 5),
    ('game_of_life', 'chaos', 30, 3),
    ('json_transform', 'data', 30, 3),
    ('word_count', 'data', 30, 3),
    ('sort_benchmark', 'data', 120, 3),
    ('hash_data', 'data', 30, 3)
ON CONFLICT (job_type) DO UPDATE
    SET handler = EXCLUDED.handler,
        timeout_seconds = EXCLUDED.timeout_seconds,
        max_retries = EXCLUDED.max_retries;
