import { db } from "./db"

export interface Job {
  job_id: number
  job_type: string
  payload: Record<string, unknown>
  status: string
  result: Record<string, unknown> | null
  error: string | null
  attempts: number
  priority: number
  created_at: string
  updated_at: string
  code?: string
  language?: string
  worker_id?: string
  execution_logs?: string[]
}

export interface Worker {
  worker_id: string
  status: string
  current_job_id: number | null
  jobs_processed: number
  started_at: string
  last_heartbeat: string
}

export interface Metrics {
  jobs_total: number
  jobs_pending: number
  jobs_running: number
  jobs_completed: number
  jobs_failed: number
  avg_duration_ms: number
  workers_active: number
  queue_size: number
}

export async function enqueueJob(
  jobType: string,
  payload: Record<string, unknown> = {},
  priority: number = 0
): Promise<number> {
  const result = await db.queryOne<{ enqueue: number }>(
    "SELECT enqueue($1, $2::jsonb, $3) as enqueue",
    [jobType, JSON.stringify(payload), priority]
  )
  return result?.enqueue || 0
}

export async function getJobStatus(jobId: number): Promise<Job | null> {
  return db.queryOne<Job>("SELECT * FROM get_job_status($1)", [jobId])
}

export async function retryJob(jobId: number): Promise<number> {
  const result = await db.queryOne<{ retry_job: number }>(
    "SELECT retry_job($1) as retry_job",
    [jobId]
  )
  return result?.retry_job || 0
}

export async function listJobs(
  status?: string,
  jobType?: string,
  limit: number = 50,
  offset: number = 0
): Promise<Job[]> {
  return db.query<Job>("SELECT * FROM list_jobs($1, $2, $3, $4)", [
    status,
    jobType,
    limit,
    offset,
  ])
}

export async function getMetrics(): Promise<Metrics> {
  const result = await db.queryOne<Metrics>("SELECT * FROM get_metrics()")
  return (
    result || {
      jobs_total: 0,
      jobs_pending: 0,
      jobs_running: 0,
      jobs_completed: 0,
      jobs_failed: 0,
      avg_duration_ms: 0,
      workers_active: 0,
      queue_size: 0,
    }
  )
}

export async function listWorkers(): Promise<Worker[]> {
  return db.query<Worker>("SELECT * FROM workers ORDER BY last_heartbeat DESC")
}

export async function listJobTypes(): Promise<
  {
    job_type: string
    handler: string
    timeout_seconds: number
    max_retries: number
  }[]
> {
  return db.query(
    "SELECT job_type, handler, timeout_seconds, max_retries FROM jobs_registry ORDER BY job_type"
  )
}

export async function deleteJob(jobId: number): Promise<boolean> {
  const result = await db.execute("DELETE FROM jobs_state WHERE job_id = $1", [
    jobId,
  ])
  return result > 0
}

export async function executeDynamicWorker(
  code: string,
  language: string = "javascript",
  input: Record<string, unknown> = {},
  cacheId?: string
): Promise<Job> {
  // Insert job with code - will be executed via executeJobNow
  const job = await db.queryOne<Job>(
    `INSERT INTO jobs_state (job_type, payload, code, language, worker_id, status)
     VALUES ('dynamic_worker', $1::jsonb, $2, $3, $4, 'pending')
     RETURNING *`,
    [JSON.stringify(input), code, language, cacheId || null]
  )

  if (!job) {
    throw new Error("Failed to create dynamic worker job")
  }

  // Execute immediately (for now - could also queue)
  await executeJobNow(job.job_id)

  return job
}

export async function executeJobNow(jobId: number): Promise<void> {
  // Get job from database
  const job = await db.queryOne<{
    job_id: number
    code: string
    language: string
    payload: Record<string, unknown>
    worker_id: string | null
    status: string
  }>(
    "SELECT job_id, code, language, payload, worker_id, status FROM jobs_state WHERE job_id = $1",
    [jobId]
  )

  if (!job || !job.code) {
    console.error(`Job ${jobId} not found or has no code`)
    return
  }

  // Update to running
  await db.execute(
    "UPDATE jobs_state SET status = 'running', attempts = attempts + 1, updated_at = NOW() WHERE job_id = $1",
    [jobId]
  )

  try {
    // Import Cloudflare client dynamically to avoid build issues
    const { getDynamicWorkerClient } = await import("../lib/cloudflare-client")
    const client = getDynamicWorkerClient()

    let result: {
      success: boolean
      result?: unknown
      error?: string
      executionTimeMs: number
      isWarm?: boolean
    }

    // Use get() if cacheId exists, otherwise use load()
    if (job.worker_id) {
      result = await client.get({
        cacheId: job.worker_id,
        code: job.code,
        input: job.payload,
      })
    } else {
      result = await client.load({
        code: job.code,
        input: job.payload,
      })
    }

    // Update job with result
    await db.execute(
      `UPDATE jobs_state 
       SET status = $1, 
           result = $2, 
           error = $3,
           updated_at = NOW() 
       WHERE job_id = $4`,
      [
        result.success ? "completed" : "failed",
        result.success ? JSON.stringify(result.result) : null,
        result.error || null,
        jobId,
      ]
    )

    console.log(
      `Job ${jobId} completed in ${result.executionTimeMs}ms (warm: ${result.isWarm})`
    )
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)

    await db.execute(
      "UPDATE jobs_state SET status = 'failed', error = $1, updated_at = NOW() WHERE job_id = $2",
      [error, jobId]
    )

    console.error(`Job ${jobId} failed:`, error)
  }
}
