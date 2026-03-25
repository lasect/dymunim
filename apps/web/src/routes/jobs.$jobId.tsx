import { createFileRoute, Link } from "@tanstack/react-router"
import { useState } from "react"
import { IconArrowLeft, IconRefresh, IconPlayerPlay } from "@tabler/icons-react"
import { Button } from "@workspace/ui/components/button"
import { getJobStatus, retryJob, type Job } from "../server/functions"

export const Route = createFileRoute("/jobs/$jobId")({
  component: JobDetailPage,
  loader: async ({ params }) => {
    const jobId = parseInt(params.jobId, 10)
    const job = await getJobStatus(jobId)
    if (!job) {
      throw new Error("Job not found")
    }
    return { job }
  },
})

function JobDetailPage() {
  const { job: initialJob } = Route.useLoaderData()
  const [job, setJob] = useState<Job>(initialJob)
  const [retrying, setRetrying] = useState(false)

  const refreshJob = async () => {
    const updated = await getJobStatus(job.job_id)
    if (updated) {
      setJob(updated)
    }
  }

  const handleRetry = async () => {
    setRetrying(true)
    try {
      await retryJob(job.job_id)
      await refreshJob()
    } finally {
      setRetrying(false)
    }
  }

  const getStatusStyles = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-500/10 text-green-700 border-green-500/20"
      case "failed":
        return "bg-red-500/10 text-red-700 border-red-500/20"
      case "running":
        return "bg-blue-500/10 text-blue-700 border-blue-500/20"
      case "pending":
        return "bg-yellow-500/10 text-yellow-700 border-yellow-500/20"
      default:
        return "bg-gray-500/10 text-gray-700 border-gray-500/20"
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <Link
          to="/jobs"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <IconArrowLeft className="h-4 w-4" />
          Back to Jobs
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Job #{job.job_id}</h1>
            <p className="text-sm text-muted-foreground">{job.job_type}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={refreshJob}>
              <IconRefresh className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            {job.status === "failed" && (
              <Button size="sm" onClick={handleRetry} disabled={retrying}>
                <IconPlayerPlay className="mr-2 h-4 w-4" />
                {retrying ? "Retrying..." : "Retry"}
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-md border p-4">
          <h2 className="mb-4 text-lg font-semibold">Job Details</h2>
          <dl className="space-y-3">
            <div className="flex justify-between">
              <dt className="text-sm text-muted-foreground">Status</dt>
              <dd>
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getStatusStyles(job.status)}`}
                >
                  {job.status}
                </span>
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-muted-foreground">Priority</dt>
              <dd className="text-sm">{job.priority}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-muted-foreground">Attempts</dt>
              <dd className="text-sm">{job.attempts}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-muted-foreground">Created</dt>
              <dd className="text-sm">
                {new Date(job.created_at).toLocaleString()}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm text-muted-foreground">Updated</dt>
              <dd className="text-sm">
                {new Date(job.updated_at).toLocaleString()}
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-md border p-4">
          <h2 className="mb-4 text-lg font-semibold">Payload</h2>
          <pre className="overflow-auto rounded-md bg-muted p-3 text-xs">
            {JSON.stringify(job.payload, null, 2)}
          </pre>
        </div>

        {job.result && (
          <div className="rounded-md border p-4 md:col-span-2">
            <h2 className="mb-4 text-lg font-semibold">Result</h2>
            <pre className="overflow-auto rounded-md bg-muted p-3 text-xs">
              {JSON.stringify(job.result, null, 2)}
            </pre>
          </div>
        )}

        {job.error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-4 md:col-span-2">
            <h2 className="mb-4 text-lg font-semibold text-red-700">Error</h2>
            <pre className="overflow-auto rounded-md bg-red-100 p-3 text-xs text-red-800">
              {job.error}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}
