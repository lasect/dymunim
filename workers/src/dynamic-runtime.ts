import { query, queryOne, execute } from "./db"
import { WebSocketServer, WebSocket } from "ws"
import * as vm from "node:vm"
import { createHash } from "node:crypto"

interface DynamicWorkerConfig {
  code: string
  language: "javascript" | "typescript" | "python"
  input?: Record<string, unknown>
  cacheId?: string
  timeoutMs?: number
}

interface WorkerCache {
  cacheId: string
  codeHash: string
  code: string
  language: string
  compiled?: vm.Script
  useCount: number
  createdAt: Date
  lastUsedAt: Date
}

// In-memory cache for warm workers
const workerCache = new Map<string, WorkerCache>()
const CACHE_MAX_AGE_MS = 5 * 60 * 1000 // 5 minutes
const CACHE_MAX_SIZE = 100

export class DynamicWorkerRuntime {
  private wsServer: WebSocketServer | null = null
  private clients = new Set<WebSocket>()

  constructor(private wsPort: number = 3001) {}

  async start() {
    this.wsServer = new WebSocketServer({ port: this.wsPort })

    this.wsServer.on("connection", (ws) => {
      this.clients.add(ws)
      console.log("Dynamic Worker runtime client connected")

      ws.on("close", () => {
        this.clients.delete(ws)
      })

      ws.on("message", async (data) => {
        try {
          const msg = JSON.parse(data.toString())
          await this.handleMessage(ws, msg)
        } catch (e) {
          console.error("Invalid WS message:", e)
          ws.send(
            JSON.stringify({ type: "error", error: "Invalid message format" })
          )
        }
      })
    })

    console.log(`Dynamic Worker runtime on port ${this.wsPort}`)

    // Start cache cleanup interval
    setInterval(() => this.cleanupCache(), 60000)
  }

  private async handleMessage(
    ws: WebSocket,
    msg: { type: string; payload?: unknown }
  ) {
    switch (msg.type) {
      case "load": {
        const { code, language, input, timeoutMs } =
          msg.payload as DynamicWorkerConfig
        const result = await this.load(code, language, input, timeoutMs)
        ws.send(JSON.stringify({ type: "load_result", result }))
        break
      }
      case "get": {
        const { cacheId, code, language, input, timeoutMs } =
          msg.payload as DynamicWorkerConfig & { cacheId: string }
        const result = await this.get(cacheId, code, language, input, timeoutMs)
        ws.send(JSON.stringify({ type: "get_result", result }))
        break
      }
      case "execute_job": {
        const { jobId } = msg.payload as { jobId: number }
        await this.executeJob(jobId)
        break
      }
    }
  }

  /**
   * Load a fresh Dynamic Worker for one-time execution (like Cloudflare's load())
   */
  async load(
    code: string,
    language: "javascript" | "typescript" | "python" = "javascript",
    input: Record<string, unknown> = {},
    timeoutMs: number = 30000
  ): Promise<{
    success: boolean
    result?: unknown
    error?: string
    logs: string[]
    executionTimeMs: number
  }> {
    const logs: string[] = []
    const startTime = Date.now()

    try {
      // For now, only support JavaScript
      if (language !== "javascript") {
        throw new Error(
          `Language '${language}' not yet supported. Use 'javascript'.`
        )
      }

      // Create sandbox with controlled bindings
      const sandbox = {
        console: {
          log: (...args: unknown[]) => {
            const log = args
              .map((a) =>
                typeof a === "object" ? JSON.stringify(a) : String(a)
              )
              .join(" ")
            logs.push(log)
            console.log("[Worker]", log)
          },
          error: (...args: unknown[]) => {
            const log = args
              .map((a) =>
                typeof a === "object" ? JSON.stringify(a) : String(a)
              )
              .join(" ")
            logs.push(`ERROR: ${log}`)
            console.error("[Worker]", log)
          },
        },
        input,
        Math,
        JSON,
        Date,
        Array,
        Object,
        String,
        Number,
        Boolean,
        RegExp,
        Error,
        Promise,
        setTimeout: () => {
          throw new Error("setTimeout not allowed")
        },
        setInterval: () => {
          throw new Error("setInterval not allowed")
        },
        require: () => {
          throw new Error("require not allowed")
        },
        process: undefined,
        Buffer: undefined,
        global: undefined,
      }

      const context = vm.createContext(sandbox)

      // Wrap code in async function
      const wrappedCode = `
        (async () => {
          ${code}
        })()
      `

      const script = new vm.Script(wrappedCode)

      const result = await script.runInContext(context, {
        timeout: timeoutMs,
        displayErrors: true,
      })

      const executionTimeMs = Date.now() - startTime

      return {
        success: true,
        result,
        logs,
        executionTimeMs,
      }
    } catch (err) {
      const executionTimeMs = Date.now() - startTime
      const error = err instanceof Error ? err.message : String(err)

      return {
        success: false,
        error,
        logs,
        executionTimeMs,
      }
    }
  }

  /**
   * Get or create a cached Dynamic Worker (like Cloudflare's get())
   */
  async get(
    cacheId: string,
    code: string,
    language: "javascript" | "typescript" | "python" = "javascript",
    input: Record<string, unknown> = {},
    timeoutMs: number = 30000
  ): Promise<{
    success: boolean
    result?: unknown
    error?: string
    logs: string[]
    executionTimeMs: number
    isWarm: boolean
  }> {
    const codeHash = createHash("sha256").update(code).digest("hex")
    const cached = workerCache.get(cacheId)

    let isWarm = false

    // Check if we have a warm worker with matching code
    if (cached && cached.codeHash === codeHash) {
      isWarm = true
      cached.useCount++
      cached.lastUsedAt = new Date()
      console.log(
        `Using warm worker: ${cacheId} (used ${cached.useCount} times)`
      )
    } else {
      // Cache miss - store for future use
      console.log(`Creating new worker: ${cacheId}`)
      workerCache.set(cacheId, {
        cacheId,
        codeHash,
        code,
        language,
        useCount: 1,
        createdAt: new Date(),
        lastUsedAt: new Date(),
      })
    }

    // Execute the worker
    const result = await this.load(code, language, input, timeoutMs)

    return {
      ...result,
      isWarm,
    }
  }

  /**
   * Execute a job from the database (for queue-based execution)
   */
  async executeJob(jobId: number): Promise<void> {
    const job = await queryOne<{
      job_id: number
      code: string
      language: string
      payload: Record<string, unknown>
      cache_id?: string
    }>(
      "SELECT job_id, code, language, payload, worker_id as cache_id FROM jobs_state WHERE job_id = $1",
      [jobId]
    )

    if (!job || !job.code) {
      console.error(`Job ${jobId} not found or has no code`)
      return
    }

    // Update status to running
    await execute(
      "UPDATE jobs_state SET status = 'running', attempts = attempts + 1, updated_at = NOW() WHERE job_id = $1",
      [jobId]
    )

    this.broadcast({
      type: "job_started",
      jobId,
      timestamp: new Date().toISOString(),
    })

    try {
      // Use get() if cache_id exists, otherwise use load()
      const result = job.cache_id
        ? await this.get(
            job.cache_id,
            job.code,
            job.language as "javascript",
            job.payload
          )
        : await this.load(job.code, job.language as "javascript", job.payload)

      // Update job with result
      await execute(
        `UPDATE jobs_state 
         SET status = $1, 
             result = $2, 
             error = $3,
             execution_logs = $4,
             updated_at = NOW() 
         WHERE job_id = $5`,
        [
          result.success ? "completed" : "failed",
          result.success ? JSON.stringify(result.result) : null,
          result.error || null,
          JSON.stringify(result.logs),
          jobId,
        ]
      )

      this.broadcast({
        type: result.success ? "job_completed" : "job_failed",
        jobId,
        executionTimeMs: result.executionTimeMs,
        isWarm: "isWarm" in result ? result.isWarm : false,
        timestamp: new Date().toISOString(),
      })
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)

      await execute(
        "UPDATE jobs_state SET status = 'failed', error = $1, updated_at = NOW() WHERE job_id = $2",
        [error, jobId]
      )

      this.broadcast({
        type: "job_failed",
        jobId,
        error,
        timestamp: new Date().toISOString(),
      })
    }
  }

  private cleanupCache() {
    const now = Date.now()
    let cleaned = 0

    for (const [cacheId, cached] of workerCache.entries()) {
      // Remove if older than max age
      if (now - cached.lastUsedAt.getTime() > CACHE_MAX_AGE_MS) {
        workerCache.delete(cacheId)
        cleaned++
      }
    }

    // If still too big, remove least recently used
    if (workerCache.size > CACHE_MAX_SIZE) {
      const sorted = Array.from(workerCache.entries()).sort(
        (a, b) => a[1].lastUsedAt.getTime() - b[1].lastUsedAt.getTime()
      )

      const toRemove = sorted.slice(0, workerCache.size - CACHE_MAX_SIZE)
      for (const [cacheId] of toRemove) {
        workerCache.delete(cacheId)
        cleaned++
      }
    }

    if (cleaned > 0) {
      console.log(`Cleaned up ${cleaned} cached workers`)
    }
  }

  private broadcast(message: unknown) {
    const data = JSON.stringify(message)
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data)
      }
    })
  }

  stop() {
    if (this.wsServer) {
      this.wsServer.close()
    }
    workerCache.clear()
  }
}

// Singleton instance
let runtime: DynamicWorkerRuntime | null = null

export function getRuntime(wsPort?: number): DynamicWorkerRuntime {
  if (!runtime) {
    runtime = new DynamicWorkerRuntime(wsPort)
  }
  return runtime
}
