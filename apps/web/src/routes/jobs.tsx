import { createFileRoute, useNavigate, Link } from "@tanstack/react-router"
import { useState, useCallback } from "react"
import {
  IconRefresh,
  IconPlus,
  IconFilter,
  IconEye,
  IconWifi,
  IconWifiOff,
} from "@tabler/icons-react"
import { Button } from "@workspace/ui/components/button"
import { listJobs, type Job } from "../server/functions"
import { useWebSocket } from "../hooks/useWebSocket"

export const Route = createFileRoute("/jobs")({
  component: JobsPage,
  loader: async () => {
    const jobs = await listJobs()
    return { jobs }
  },
})

function JobsPage() {
  const { jobs: initialJobs } = Route.useLoaderData()
  const [jobs, setJobs] = useState<Job[]>(initialJobs)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const navigate = useNavigate()

  const refreshJobs = async () => {
    const status = statusFilter === "all" ? undefined : statusFilter
    const updated = await listJobs(status, undefined, 50, 0)
    setJobs(updated)
  }

  const handleWebSocketMessage = useCallback(
    (data: {
      type: string
      jobId?: number
      jobType?: string
      result?: unknown
      error?: string
    }) => {
      if (data.type === "job_completed" || data.type === "job_failed") {
        refreshJobs()
      }
    },
    [statusFilter]
  )

  const { isConnected } = useWebSocket({
    url: `ws://${typeof window !== "undefined" ? window.location.hostname : "localhost"}:3001`,
    onMessage: handleWebSocketMessage,
  })

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
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Jobs</h1>
          <p className="text-sm text-muted-foreground">
            Manage and monitor job execution
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-1 text-xs text-muted-foreground"
            title={
              isConnected
                ? "Connected to real-time updates"
                : "Disconnected from real-time updates"
            }
          >
            {isConnected ? (
              <IconWifi className="h-4 w-4 text-green-500" />
            ) : (
              <IconWifiOff className="h-4 w-4 text-red-500" />
            )}
          </div>
          <Button variant="outline" size="sm" onClick={refreshJobs}>
            <IconRefresh className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => navigate({ to: "/jobs/new" })}>
            <IconPlus className="mr-2 h-4 w-4" />
            New Job
          </Button>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <IconFilter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Filter:</span>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="running">Running</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      <div className="rounded-md border">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left text-sm font-medium">ID</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Type</th>
              <th className="px-4 py-3 text-left text-sm font-medium">
                Status
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium">
                Priority
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium">
                Attempts
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium">
                Created
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-sm text-muted-foreground"
                >
                  No jobs found. Create a new job to get started.
                </td>
              </tr>
            ) : (
              jobs.map((job) => (
                <tr
                  key={job.job_id}
                  className="border-b transition-colors hover:bg-muted/50"
                >
                  <td className="px-4 py-3 font-mono text-sm">#{job.job_id}</td>
                  <td className="px-4 py-3 text-sm">{job.job_type}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors ${getStatusStyles(job.status)}`}
                    >
                      {job.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">{job.priority}</td>
                  <td className="px-4 py-3 text-sm">{job.attempts}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {new Date(job.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to="/jobs/$jobId"
                      params={{ jobId: String(job.job_id) }}
                      className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                    >
                      <IconEye className="h-4 w-4" />
                      View
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
