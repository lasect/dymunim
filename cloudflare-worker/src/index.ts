export interface Env {
  LOADER: WorkerLoader
  DYMUNIM_DB_URL: string
}

interface WorkerLoader {
  load(options: LoadOptions): DynamicWorker
  get(id: string, callback: () => Promise<LoadOptions>): DynamicWorker
}

interface LoadOptions {
  mainModule: string
  modules: Record<string, string>
  compatibilityDate?: string
  globalOutbound?: string | null
}

interface DynamicWorker {
  getEntrypoint(): WorkerEntrypoint
}

interface WorkerEntrypoint {
  fetch(request: Request): Promise<Response>
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // CORS headers
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      })
    }

    // API endpoints
    if (url.pathname === "/load" && request.method === "POST") {
      return handleLoad(request, env)
    }
    if (url.pathname === "/get" && request.method === "POST") {
      return handleGet(request, env)
    }
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok" }), {
        headers: { "Content-Type": "application/json" },
      })
    }

    return new Response("Not Found", { status: 404 })
  },
}

async function handleLoad(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json()
    const {
      code,
      input = {},
      timeout = 30000,
    } = body as {
      code: string
      input?: Record<string, unknown>
      timeout?: number
    }

    // Wrap the user code in a fetch handler
    const wrappedCode = `
export default {
  async fetch(request) {
    const input = ${JSON.stringify(input)};
    
    ${code}
    
    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" }
    });
  }
}
`

    // Load a fresh Dynamic Worker
    const worker = env.LOADER.load({
      compatibilityDate: "$today",
      mainModule: "index.js",
      modules: {
        "index.js": wrappedCode,
      },
      globalOutbound: null, // Block all outbound network
    })

    const entrypoint = worker.getEntrypoint()

    // Execute with a mock request
    const mockRequest = new Request("http://localhost/execute", {
      method: "GET",
    })

    const startTime = Date.now()
    const response = await Promise.race([
      entrypoint.fetch(mockRequest),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), timeout)
      ),
    ])

    const executionTimeMs = Date.now() - startTime

    let result: unknown
    try {
      result = await response.json()
    } catch {
      result = await response.text()
    }

    return new Response(
      JSON.stringify({
        success: true,
        result,
        executionTimeMs,
        isWarm: false,
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    )
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    return new Response(
      JSON.stringify({
        success: false,
        error,
        executionTimeMs: 0,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}

async function handleGet(request: Request, env: Env): Promise<Response> {
  try {
    const body = await request.json()
    const {
      cacheId,
      code,
      input = {},
      timeout = 30000,
    } = body as {
      cacheId: string
      code: string
      input?: Record<string, unknown>
      timeout?: number
    }

    // Wrap the user code in a fetch handler
    const wrappedCode = `
export default {
  async fetch(request) {
    const input = ${JSON.stringify(input)};
    
    ${code}
    
    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" }
    });
  }
}
`

    // Get or create a cached Dynamic Worker
    const worker = env.LOADER.get(cacheId, async () => ({
      compatibilityDate: "$today",
      mainModule: "index.js",
      modules: {
        "index.js": wrappedCode,
      },
      globalOutbound: null,
    }))

    const entrypoint = worker.getEntrypoint()

    const mockRequest = new Request("http://localhost/execute", {
      method: "GET",
    })

    const startTime = Date.now()
    const response = await Promise.race([
      entrypoint.fetch(mockRequest),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), timeout)
      ),
    ])

    const executionTimeMs = Date.now() - startTime

    let result: unknown
    try {
      result = await response.json()
    } catch {
      result = await response.text()
    }

    return new Response(
      JSON.stringify({
        success: true,
        result,
        executionTimeMs,
        isWarm: true, // get() always returns warm if cache hit
      }),
      { headers: { "Content-Type": "application/json" } }
    )
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    return new Response(
      JSON.stringify({
        success: false,
        error,
        executionTimeMs: 0,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}
