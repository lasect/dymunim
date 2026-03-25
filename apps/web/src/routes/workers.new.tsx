import { createFileRoute, Link } from "@tanstack/react-router"
import { useState } from "react"
import { IconArrowLeft, IconSend, IconCode } from "@tabler/icons-react"
import { Button } from "@workspace/ui/components/button"
import { executeDynamicWorker, type Job } from "../server/functions"

export const Route = createFileRoute("/workers/new")({
  component: NewDynamicWorkerPage,
})

const exampleCode = `// Your code runs in a sandboxed environment
// Available bindings:
// - console.log() / console.error() - for logging
// - input - the input payload as an object
// - Math, JSON, Date, Array, Object, etc. - standard JS globals
// - Return a value to get it as the result

function fibonacci(n) {
  if (n <= 1) return n
  let a = 0, b = 1
  for (let i = 2; i <= n; i++) {
    [a, b] = [b, a + b]
  }
  return b
}

const n = input.n || 10
console.log('Calculating fibonacci(' + n + ')...')

const result = fibonacci(n)

return {
  n,
  result,
  timestamp: new Date().toISOString()
}`

function NewDynamicWorkerPage() {
  const [code, setCode] = useState(exampleCode)
  const [language, setLanguage] = useState("javascript")
  const [input, setInput] = useState('{"n": 50}')
  const [cacheId, setCacheId] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{
    job?: Job
    executionResult?: {
      success: boolean
      result?: unknown
      error?: string
      logs: string[]
      executionTimeMs: number
      isWarm?: boolean
    }
  } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      let parsedInput: Record<string, unknown>
      try {
        parsedInput = JSON.parse(input)
      } catch {
        alert("Invalid JSON input")
        setSubmitting(false)
        return
      }

      const job = await executeDynamicWorker(
        code,
        language as "javascript" | "typescript" | "python",
        parsedInput,
        cacheId || undefined
      )

      setResult({ job })
    } catch (err) {
      alert(
        "Failed to create worker: " +
          (err instanceof Error ? err.message : String(err))
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <Link
          to="/workers"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <IconArrowLeft className="h-4 w-4" />
          Back to Workers
        </Link>
        <h1 className="text-2xl font-bold">Create Dynamic Worker</h1>
        <p className="text-sm text-muted-foreground">
          Execute code in a sandboxed environment (like Cloudflare Dynamic
          Workers)
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium">Language</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="javascript">JavaScript</option>
              <option value="typescript" disabled>
                TypeScript (coming soon)
              </option>
              <option value="python" disabled>
                Python (coming soon)
              </option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Cache ID (optional)
            </label>
            <input
              type="text"
              value={cacheId}
              onChange={(e) => setCacheId(e.target.value)}
              placeholder="my-worker-v1"
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Reuse this worker across executions (warm starts)
            </p>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">Input (JSON)</label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="h-24 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
            spellCheck={false}
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">Code</label>
          <div className="relative">
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="h-96 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
              spellCheck={false}
            />
            <IconCode className="absolute top-3 right-3 h-5 w-5 text-muted-foreground" />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Your code runs in a secure sandbox with limited bindings
          </p>
        </div>

        <div className="flex gap-3">
          <Button type="submit" disabled={submitting}>
            <IconSend className="mr-2 h-4 w-4" />
            {submitting ? "Creating..." : "Execute Worker"}
          </Button>
        </div>
      </form>

      {result?.job && (
        <div className="mt-8 rounded-md border p-4">
          <h2 className="mb-4 text-lg font-semibold">Job Created</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Job ID</span>
              <span className="font-mono font-medium">
                #{result.job.job_id}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  result.job.status === "completed"
                    ? "bg-green-100 text-green-700"
                    : result.job.status === "failed"
                      ? "bg-red-100 text-red-700"
                      : "bg-yellow-100 text-yellow-700"
                }`}
              >
                {result.job.status}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Language</span>
              <span>{result.job.language}</span>
            </div>
          </div>
          <div className="mt-4">
            <Link
              to="/jobs/$jobId"
              params={{ jobId: String(result.job.job_id) }}
              className="text-sm font-medium text-primary hover:underline"
            >
              View job details →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
