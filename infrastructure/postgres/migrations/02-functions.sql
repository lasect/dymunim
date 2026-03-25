-- Enqueue function
CREATE OR REPLACE FUNCTION enqueue(
    p_job_type TEXT,
    p_payload JSONB DEFAULT '{}',
    p_priority INT DEFAULT 0
)
RETURNS BIGINT AS $$
DECLARE
    v_job_id BIGINT;
    v_timeout INT;
    v_max_retries INT;
BEGIN
    -- Get job config from registry
    SELECT timeout_seconds, max_retries INTO v_timeout, v_max_retries
    FROM jobs_registry
    WHERE job_type = p_job_type;

    -- Default values if not in registry
    v_timeout := COALESCE(v_timeout, 30);
    v_max_retries := COALESCE(v_max_retries, 3);

    -- Insert job state
    INSERT INTO jobs_state (job_type, payload, status, priority, attempts)
    VALUES (p_job_type, p_payload, 'pending', p_priority, 0)
    RETURNING job_id INTO v_job_id;

    -- Send to PGMQ with visibility timeout based on config
    PERFORM pgmq.send(
        'dymunim_jobs',
        jsonb_build_object(
            'job_id', v_job_id,
            'job_type', p_job_type,
            'payload', p_payload
        ),
        v_timeout,
        p_priority
    );

    RETURN v_job_id;
END;
$$ LANGUAGE plpgsql;

-- Get job status
CREATE OR REPLACE FUNCTION get_job_status(p_job_id BIGINT)
RETURNS TABLE (
    job_id BIGINT,
    job_type TEXT,
    payload JSONB,
    status TEXT,
    result JSONB,
    error TEXT,
    attempts INT,
    priority INT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        js.job_id,
        js.job_type,
        js.payload,
        js.status,
        js.result,
        js.error,
        js.attempts,
        js.priority,
        js.created_at,
        js.updated_at
    FROM jobs_state js
    WHERE js.job_id = p_job_id;
END;
$$ LANGUAGE plpgsql;

-- Retry failed job
CREATE OR REPLACE FUNCTION retry_job(p_job_id BIGINT)
RETURNS BIGINT AS $$
DECLARE
    v_job_type TEXT;
    v_payload JSONB;
    v_priority INT;
    v_new_job_id BIGINT;
BEGIN
    -- Get original job info
    SELECT job_type, payload, priority INTO v_job_type, v_payload, v_priority
    FROM jobs_state
    WHERE job_id = p_job_id;

    IF v_job_type IS NULL THEN
        RAISE EXCEPTION 'Job not found: %', p_job_id;
    END IF;

    -- Check max retries
    DECLARE
        v_max_retries INT;
        v_attempts INT;
    BEGIN
        SELECT COALESCE(max_retries, 3), attempts INTO v_max_retries, v_attempts
        FROM jobs_registry jr
        JOIN jobs_state js ON js.job_type = jr.job_type
        WHERE js.job_id = p_job_id;

        v_max_retries := COALESCE(v_max_retries, 3);
        
        IF v_attempts >= v_max_retries THEN
            RAISE EXCEPTION 'Max retries exceeded for job: %', p_job_id;
        END IF;
    END;

    -- Insert new job
    INSERT INTO jobs_state (job_type, payload, status, priority, attempts)
    VALUES (v_job_type, v_payload, 'pending', v_priority, 0)
    RETURNING job_id INTO v_new_job_id;

    -- Send to PGMQ
    PERFORM pgmq.send(
        'dymunim_jobs',
        jsonb_build_object(
            'job_id', v_new_job_id,
            'job_type', v_job_type,
            'payload', v_payload
        )
    );

    RETURN v_new_job_id;
END;
$$ LANGUAGE plpgsql;

-- List jobs with filters
CREATE OR REPLACE FUNCTION list_jobs(
    p_status TEXT DEFAULT NULL,
    p_job_type TEXT DEFAULT NULL,
    p_limit INT DEFAULT 50,
    p_offset INT DEFAULT 0
)
RETURNS TABLE (
    job_id BIGINT,
    job_type TEXT,
    payload JSONB,
    status TEXT,
    result JSONB,
    error TEXT,
    attempts INT,
    priority INT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        js.job_id,
        js.job_type,
        js.payload,
        js.status,
        js.result,
        js.error,
        js.attempts,
        js.priority,
        js.created_at,
        js.updated_at
    FROM jobs_state js
    WHERE (p_status IS NULL OR js.status = p_status)
      AND (p_job_type IS NULL OR js.job_type = p_job_type)
    ORDER BY js.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- Get system metrics
CREATE OR REPLACE FUNCTION get_metrics()
RETURNS TABLE (
    jobs_total BIGINT,
    jobs_pending BIGINT,
    jobs_running BIGINT,
    jobs_completed BIGINT,
    jobs_failed BIGINT,
    avg_duration_ms NUMERIC,
    workers_active BIGINT,
    queue_size BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT AS jobs_total,
        COUNT(*) FILTER (WHERE status = 'pending')::BIGINT AS jobs_pending,
        COUNT(*) FILTER (WHERE status = 'running')::BIGINT AS jobs_running,
        COUNT(*) FILTER (WHERE status = 'completed')::BIGINT AS jobs_completed,
        COUNT(*) FILTER (WHERE status = 'failed')::BIGINT AS jobs_failed,
        AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) * 1000) FILTER (WHERE status = 'completed')::NUMERIC AS avg_duration_ms,
        (SELECT COUNT(*) FROM workers WHERE status = 'busy')::BIGINT AS workers_active,
        (SELECT pgmq.queue_length('dymunim_jobs'))::BIGINT AS queue_size;
END;
$$ LANGUAGE plpgsql;

-- Register a job type
CREATE OR REPLACE FUNCTION register_job(
    p_job_type TEXT,
    p_handler TEXT,
    p_timeout_seconds INT DEFAULT 30,
    p_max_retries INT DEFAULT 3
)
RETURNS void AS $$
BEGIN
    INSERT INTO jobs_registry (job_type, handler, timeout_seconds, max_retries)
    VALUES (p_job_type, p_handler, p_timeout_seconds, p_max_retries)
    ON CONFLICT (job_type) DO UPDATE
    SET handler = EXCLUDED.handler,
        timeout_seconds = EXCLUDED.timeout_seconds,
        max_retries = EXCLUDED.max_retries;
END;
$$ LANGUAGE plpgsql;

-- Update job status
CREATE OR REPLACE FUNCTION update_job_status(
    p_job_id BIGINT,
    p_status TEXT,
    p_result JSONB DEFAULT NULL,
    p_error TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
    UPDATE jobs_state
    SET status = p_status,
        result = COALESCE(p_result, result),
        error = p_error,
        updated_at = NOW()
    WHERE job_id = p_job_id;
END;
$$ LANGUAGE plpgsql;