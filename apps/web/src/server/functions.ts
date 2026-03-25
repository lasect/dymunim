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
  const job = await db.queryOne<Job>(
    `INSERT INTO jobs_state (job_type, payload, code, language, worker_id, status)
     VALUES ('dynamic_worker', $1::jsonb, $2, $3, $4, 'pending')
     RETURNING *`,
    [JSON.stringify(input), code, language, cacheId || null]
  )

  if (!job) {
    throw new Error("Failed to create dynamic worker job")
  }

  return job
}

export async function executeJobNow(jobId: number): Promise<void> {
  // This would trigger the worker to execute the job
  // In a real system, this would send a message to the worker runtime
  console.log(`Triggering execution for job ${jobId}`)
}
