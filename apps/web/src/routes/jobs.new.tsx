import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { IconArrowLeft, IconSend } from "@tabler/icons-react"
import { Button } from "@workspace/ui/components/button"
import { enqueueJob, listJobTypes } from "../server/functions"

export const Route = createFileRoute("/jobs/new")({
  component: NewJobPage,
  loader: async () => {
    const jobTypes = await listJobTypes()
    return { jobTypes }
  },
})

const defaultPayloads: Record<string, object> = {
  prime_sieve: { limit: 10000 },
  fibonacci: { n: 50 },
  monte_carlo: { iterations: 100000 },
  sleep: { duration: 1000 },
  random_fail: { probability: 0.5 },
  random_timeout: { maxDuration: 5000 },
  chaos_mode: { chaosType: "random", intensity: 0.5 },
  game_of_life: { width: 50, height: 20, generations: 10 },
  json_transform: {
    data: [
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" },
    ],
    operations: ["sort"],
    sortKey: "name",
  },
  word_count: { text: "The quick brown fox jumps over the lazy dog" },
  sort_benchmark: { size: 10000, algorithms: ["quick", "merge", "builtin"] },
  hash_data: { data: "hello world", algorithms: ["sha256"] },
}

function NewJobPage() {
  const { jobTypes } = Route.useLoaderData()
  const navigate = useNavigate()
  const [selectedType, setSelectedType] = useState<string>(
    jobTypes[0]?.job_type || ""
  )
  const [payload, setPayload] = useState<string>(
    JSON.stringify(defaultPayloads[jobTypes[0]?.job_type] || {}, null, 2)
  )
  const [priority, setPriority] = useState<number>(0)
  const [submitting, setSubmitting] = useState(false)

  const handleTypeChange = (type: string) => {
    setSelectedType(type)
    setPayload(JSON.stringify(defaultPayloads[type] || {}, null, 2))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const parsedPayload = JSON.parse(payload)
      const jobId = await enqueueJob(selectedType, parsedPayload, priority)
      navigate({ to: "/jobs/$jobId", params: { jobId: String(jobId) } })
    } catch (err) {
      alert(
        "Failed to create job: " +
          (err instanceof Error ? err.message : String(err))
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <button
          onClick={() => navigate({ to: "/jobs" })}
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <IconArrowLeft className="h-4 w-4" />
          Back to Jobs
        </button>
        <h1 className="text-2xl font-bold">Create New Job</h1>
        <p className="text-sm text-muted-foreground">
          Select a job type and configure its parameters
        </p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
        <div>
          <label className="mb-2 block text-sm font-medium">Job Type</label>
          <select
            value={selectedType}
            onChange={(e) => handleTypeChange(e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {jobTypes.map((jt) => (
              <option key={jt.job_type} value={jt.job_type}>
                {jt.job_type} ({jt.handler})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">Priority</label>
          <input
            type="number"
            value={priority}
            onChange={(e) => setPriority(parseInt(e.target.value, 10))}
            className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            min={0}
            max={10}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Higher priority jobs are processed first (0-10)
          </p>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium">
            Payload (JSON)
          </label>
          <textarea
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
            className="h-64 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
            spellCheck={false}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            JSON payload passed to the job handler
          </p>
        </div>

        <div className="flex gap-3">
          <Button type="submit" disabled={submitting}>
            <IconSend className="mr-2 h-4 w-4" />
            {submitting ? "Creating..." : "Create Job"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate({ to: "/jobs" })}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}
