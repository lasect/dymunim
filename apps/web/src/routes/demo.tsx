import { createFileRoute, Link } from "@tanstack/react-router"
import { useState } from "react"
import { IconArrowLeft, IconRocket, IconDice } from "@tabler/icons-react"
import { Button } from "@workspace/ui/components/button"
import { enqueueJob, listJobTypes } from "../server/functions"

export const Route = createFileRoute("/demo")({
  component: DemoPage,
  loader: async () => {
    const jobTypes = await listJobTypes()
    return { jobTypes }
  },
})

const batchConfigs = [
  {
    name: "Prime Number Batch",
    description: "Submit 10 prime sieve jobs with varying limits",
    jobs: Array.from({ length: 10 }, (_, i) => ({
      job_type: "prime_sieve",
      payload: { limit: 1000 * (i + 1) },
      priority: 0,
    })),
  },
  {
    name: "Fibonacci Batch",
    description: "Submit 5 fibonacci jobs calculating large numbers",
    jobs: Array.from({ length: 5 }, (_, i) => ({
      job_type: "fibonacci",
      payload: { n: 100 + i * 50 },
      priority: 1,
    })),
  },
  {
    name: "Chaos Test",
    description: "Submit random failure and timeout jobs",
    jobs: [
      ...Array.from({ length: 5 }, () => ({
        job_type: "random_fail",
        payload: { probability: 0.3 },
        priority: 0,
      })),
      ...Array.from({ length: 5 }, () => ({
        job_type: "random_timeout",
        payload: { maxDuration: 4000 },
        priority: 0,
      })),
    ],
  },
  {
    name: "Data Processing Batch",
    description: "Submit word count and hash jobs",
    jobs: [
      {
        job_type: "word_count",
        payload: {
          text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
        },
        priority: 0,
      },
      {
        job_type: "hash_data",
        payload: {
          data: "demo data for hashing",
          algorithms: ["sha256", "sha1"],
        },
        priority: 0,
      },
      {
        job_type: "sort_benchmark",
        payload: { size: 5000, algorithms: ["quick", "merge"] },
        priority: 0,
      },
    ],
  },
]

function DemoPage() {
  const { jobTypes } = Route.useLoaderData()
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [results, setResults] = useState<{ name: string; jobIds: number[] }[]>(
    []
  )

  const submitBatch = async (config: (typeof batchConfigs)[0]) => {
    setSubmitting(config.name)
    try {
      const jobIds: number[] = []
      for (const job of config.jobs) {
        const id = await enqueueJob(job.job_type, job.payload, job.priority)
        jobIds.push(id)
      }
      setResults((prev) => [{ name: config.name, jobIds }, ...prev])
    } catch (err) {
      alert(
        "Failed to submit batch: " +
          (err instanceof Error ? err.message : String(err))
      )
    } finally {
      setSubmitting(null)
    }
  }

  const submitRandomJobs = async (count: number) => {
    setSubmitting(`Random ${count}`)
    try {
      const jobIds: number[] = []
      for (let i = 0; i < count; i++) {
        const randomType = jobTypes[Math.floor(Math.random() * jobTypes.length)]
        const id = await enqueueJob(randomType.job_type, {}, 0)
        jobIds.push(id)
      }
      setResults((prev) => [{ name: `${count} Random Jobs`, jobIds }, ...prev])
    } catch (err) {
      alert(
        "Failed to submit jobs: " +
          (err instanceof Error ? err.message : String(err))
      )
    } finally {
      setSubmitting(null)
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <Link
          to="/"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <IconArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
        <h1 className="text-2xl font-bold">Demo Controls</h1>
        <p className="text-sm text-muted-foreground">
          Spawn batches of jobs for testing and demonstration
        </p>
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-2">
        {batchConfigs.map((config) => (
          <div key={config.name} className="rounded-md border p-4">
            <div className="mb-3">
              <h3 className="font-semibold">{config.name}</h3>
              <p className="text-sm text-muted-foreground">
                {config.description}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {config.jobs.length} jobs
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => submitBatch(config)}
              disabled={submitting === config.name}
            >
              <IconRocket className="mr-2 h-4 w-4" />
              {submitting === config.name ? "Submitting..." : "Submit Batch"}
            </Button>
          </div>
        ))}
      </div>

      <div className="mb-8 rounded-md border p-4">
        <h3 className="mb-3 font-semibold">Random Job Generator</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Submit random jobs from the registry
        </p>
        <div className="flex gap-2">
          {[5, 10, 25, 50].map((count) => (
            <Button
              key={count}
              variant="outline"
              size="sm"
              onClick={() => submitRandomJobs(count)}
              disabled={submitting === `Random ${count}`}
            >
              <IconDice className="mr-2 h-4 w-4" />
              {submitting === `Random ${count}` ? "..." : `${count} Jobs`}
            </Button>
          ))}
        </div>
      </div>

      {results.length > 0 && (
        <div className="rounded-md border">
          <div className="border-b p-4">
            <h3 className="font-semibold">Recent Submissions</h3>
          </div>
          <div className="space-y-3 p-4">
            {results.map((result, idx) => (
              <div key={idx} className="rounded-md bg-muted p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-medium">{result.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {result.jobIds.length} jobs
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {result.jobIds.slice(0, 10).map((id) => (
                    <Link
                      key={id}
                      to="/jobs/$jobId"
                      params={{ jobId: String(id) }}
                      className="rounded bg-background px-2 py-1 font-mono text-xs hover:bg-primary hover:text-primary-foreground"
                    >
                      #{id}
                    </Link>
                  ))}
                  {result.jobIds.length > 10 && (
                    <span className="px-2 py-1 text-xs text-muted-foreground">
                      +{result.jobIds.length - 10} more
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
