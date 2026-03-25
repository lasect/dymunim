-- Add code storage to jobs
ALTER TABLE jobs_state ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE jobs_state ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'javascript';
ALTER TABLE jobs_state ADD COLUMN IF NOT EXISTS worker_id TEXT;
ALTER TABLE jobs_state ADD COLUMN IF NOT EXISTS execution_logs JSONB DEFAULT '[]'::jsonb;

-- Create worker cache table for warm workers
CREATE TABLE IF NOT EXISTS worker_cache (
    cache_id TEXT PRIMARY KEY,
    code_hash TEXT NOT NULL,
    code TEXT NOT NULL,
    language TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    last_used_at TIMESTAMP DEFAULT NOW(),
    use_count INT DEFAULT 0,
    is_warm BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_worker_cache_hash ON worker_cache(code_hash);

-- Function to execute dynamic worker
CREATE OR REPLACE FUNCTION execute_dynamic_worker(
    p_code TEXT,
    p_language TEXT DEFAULT 'javascript',
    p_input JSONB DEFAULT '{}'::jsonb,
    p_cache_id TEXT DEFAULT NULL
)
RETURNS TABLE (
    job_id BIGINT,
    status TEXT,
    result JSONB,
    error TEXT,
    execution_time_ms INT,
    logs JSONB
) AS $$
DECLARE
    v_job_id BIGINT;
BEGIN
    -- Insert job with code
    INSERT INTO jobs_state (job_type, payload, code, language, status)
    VALUES ('dynamic_worker', p_input, p_code, p_language, 'pending')
    RETURNING jobs_state.job_id INTO v_job_id;

    -- Return job info (execution happens outside via worker runtime)
    RETURN QUERY
    SELECT 
        v_job_id as job_id,
        'pending'::TEXT as status,
        '{}'::JSONB as result,
        NULL::TEXT as error,
        0::INT as execution_time_ms,
        '[]'::JSONB as logs;
END;
$$ LANGUAGE plpgsql;

-- Function to get or create cached worker
CREATE OR REPLACE FUNCTION get_cached_worker(
    p_cache_id TEXT,
    p_code TEXT,
    p_language TEXT DEFAULT 'javascript'
)
RETURNS TABLE (
    cache_id TEXT,
    is_warm BOOLEAN,
    code TEXT,
    language TEXT
) AS $$
DECLARE
    v_code_hash TEXT;
    v_existing worker_cache%ROWTYPE;
BEGIN
    v_code_hash := encode(digest(p_code, 'sha256'), 'hex');
    
    -- Check for existing warm worker
    SELECT * INTO v_existing 
    FROM worker_cache 
    WHERE worker_cache.cache_id = p_cache_id 
    AND worker_cache.is_warm = true
    AND worker_cache.code_hash = v_code_hash;
    
    IF FOUND THEN
        -- Update last used
        UPDATE worker_cache 
        SET last_used_at = NOW(), use_count = use_count + 1
        WHERE worker_cache.cache_id = p_cache_id;
        
        RETURN QUERY
        SELECT 
            v_existing.cache_id,
            true as is_warm,
            v_existing.code,
            v_existing.language;
    ELSE
        -- Insert new cache entry
        INSERT INTO worker_cache (cache_id, code_hash, code, language)
        VALUES (p_cache_id, v_code_hash, p_code, p_language)
        ON CONFLICT (cache_id) DO UPDATE
        SET code_hash = v_code_hash,
            code = p_code,
            language = p_language,
            is_warm = true,
            last_used_at = NOW(),
            use_count = worker_cache.use_count + 1;
        
        RETURN QUERY
        SELECT 
            p_cache_id as cache_id,
            false as is_warm,
            p_code as code,
            p_language as language;
    END IF;
END;
$$ LANGUAGE plpgsql;
