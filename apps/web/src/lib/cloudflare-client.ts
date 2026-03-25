export interface DynamicWorkerConfig {
  code: string
  input?: Record<string, unknown>
  cacheId?: string
  timeout?: number
}

export interface DynamicWorkerResult {
  success: boolean
  result?: unknown
  error?: string
  executionTimeMs: number
  isWarm?: boolean
}

export class CloudflareDynamicWorkerClient {
  private baseUrl: string

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || process.env.CLOUDFLARE_WORKER_URL || ""

    if (!this.baseUrl) {
      console.warn(
        "CLOUDFLARE_WORKER_URL not set - Dynamic Workers will not work"
      )
    }
  }

  /**
   * Load a fresh Dynamic Worker for one-time execution
   * Corresponds to Cloudflare's env.LOADER.load()
   */
  async load(config: DynamicWorkerConfig): Promise<DynamicWorkerResult> {
    if (!this.baseUrl) {
      throw new Error("Cloudflare Worker URL not configured")
    }

    const response = await fetch(`${this.baseUrl}/load`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code: config.code,
        input: config.input || {},
        timeout: config.timeout || 30000,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Dynamic Worker failed: ${error}`)
    }

    return response.json()
  }

  /**
   * Get or create a cached Dynamic Worker
   * Corresponds to Cloudflare's env.LOADER.get(id, callback)
   */
  async get(
    config: DynamicWorkerConfig & { cacheId: string }
  ): Promise<DynamicWorkerResult> {
    if (!this.baseUrl) {
      throw new Error("Cloudflare Worker URL not configured")
    }

    const response = await fetch(`${this.baseUrl}/get`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        cacheId: config.cacheId,
        code: config.code,
        input: config.input || {},
        timeout: config.timeout || 30000,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Dynamic Worker failed: ${error}`)
    }

    return response.json()
  }

  /**
   * Check if the Cloudflare Worker is available
   */
  async healthCheck(): Promise<boolean> {
    if (!this.baseUrl) return false

    try {
      const response = await fetch(`${this.baseUrl}/health`)
      return response.ok
    } catch {
      return false
    }
  }
}

// Singleton instance
let client: CloudflareDynamicWorkerClient | null = null

export function getDynamicWorkerClient(): CloudflareDynamicWorkerClient {
  if (!client) {
    client = new CloudflareDynamicWorkerClient()
  }
  return client
}
