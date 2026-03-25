import { createFileRoute, Link } from "@tanstack/react-router"
import { useState, useEffect } from "react"
import {
  IconList,
  IconUsers,
  IconStack,
  IconChartBar,
  IconPlayerPlay,
  IconCheck,
  IconX,
  IconLoader,
  IconClock,
  IconDeviceGamepad,
} from "@tabler/icons-react"
import {
  getMetrics,
  listJobs,
  type Metrics,
  type Job,
} from "../server/functions"

export const Route = createFileRoute("/")({
  component: DashboardPage,
  loader: async () => {
    const [metrics, recentJobs] = await Promise.all([
      getMetrics(),
      listJobs(undefined, undefined, 5, 0),
    ])
    return { metrics, recentJobs }
  },
})

function DashboardPage() {
  const { metrics: initialMetrics, recentJobs: initialJobs } =
    Route.useLoaderData()
  const [metrics, setMetrics] = useState<Metrics>(initialMetrics)
  const [recentJobs, setRecentJobs] = useState<Job[]>(initialJobs)

  useEffect(() => {
    const interval = setInterval(async () => {
      const [newMetrics, newJobs] = await Promise.all([
        getMetrics(),
        listJobs(undefined, undefined, 5, 0),
      ])
      setMetrics(newMetrics)
      setRecentJobs(newJobs)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  const statCards = [
    {
      title: "Total Jobs",
      value: metrics.jobs_total,
      icon: IconList,
      href: "/jobs",
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Active Workers",
      value: metrics.workers_active,
      icon: IconUsers,
      href: "/workers",
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Queue Size",
      value: metrics.queue_size,
      icon: IconStack,
      href: "/queues",
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      title: "Metrics",
      icon: IconChartBar,
      href: "/metrics",
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      value: `${metrics.jobs_completed} done`,
    },
  ]

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <IconCheck className="h-4 w-4 text-green-500" />
      case "failed":
        return <IconX className="h-4 w-4 text-red-500" />
      case "running":
        return <IconLoader className="h-4 w-4 animate-spin text-blue-500" />
      case "pending":
        return <IconClock className="h-4 w-4 text-yellow-500" />
      default:
        return null
    }
  }

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your job queue system
        </p>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <Link
            key={card.title}
            to={card.href}
            className="group rounded-lg border bg-card p-6 transition-colors hover:bg-accent"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{card.title}</p>
                <p className="mt-1 text-2xl font-bold">{card.value}</p>
              </div>
              <div className={`rounded-lg ${card.bgColor} p-3`}>
                <card.icon className={`h-6 w-6 ${card.color}`} />
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border">
          <div className="border-b p-4">
            <h2 className="font-semibold">Recent Jobs</h2>
          </div>
          <div className="p-4">
            {recentJobs.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No jobs yet. Create your first job to get started.
              </p>
            ) : (
              <div className="space-y-3">
                {recentJobs.map((job) => (
                  <Link
                    key={job.job_id}
                    to="/jobs/$jobId"
                    params={{ jobId: String(job.job_id) }}
                    className="flex items-center justify-between rounded-md border p-3 transition-colors hover:bg-accent"
                  >
                    <div className="flex items-center gap-3">
                      {getStatusIcon(job.status)}
                      <div>
                        <p className="font-medium">{job.job_type}</p>
                        <p className="text-xs text-muted-foreground">
                          #{job.job_id} ·{" "}
                          {new Date(job.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        job.status === "completed"
                          ? "bg-green-100 text-green-700"
                          : job.status === "failed"
                            ? "bg-red-100 text-red-700"
                            : job.status === "running"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {job.status}
                    </span>
                  </Link>
                ))}
              </div>
            )}
            <div className="mt-4">
              <Link
                to="/jobs"
                className="text-sm font-medium text-primary hover:underline"
              >
                View all jobs →
              </Link>
            </div>
          </div>
        </div>

        <div className="rounded-lg border">
          <div className="border-b p-4">
            <h2 className="font-semibold">Quick Actions</h2>
          </div>
          <div className="space-y-3 p-4">
            <Link
              to="/jobs/new"
              className="flex items-center gap-3 rounded-md border p-4 transition-colors hover:bg-accent"
            >
              <div className="rounded-lg bg-primary/10 p-2">
                <IconPlayerPlay className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Create New Job</p>
                <p className="text-sm text-muted-foreground">
                  Submit a job to the queue for processing
                </p>
              </div>
            </Link>

            <Link
              to="/workers"
              className="flex items-center gap-3 rounded-md border p-4 transition-colors hover:bg-accent"
            >
              <div className="rounded-lg bg-green-100 p-2">
                <IconUsers className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="font-medium">View Workers</p>
                <p className="text-sm text-muted-foreground">
                  Monitor active worker instances
                </p>
              </div>
            </Link>

            <Link
              to="/metrics"
              className="flex items-center gap-3 rounded-md border p-4 transition-colors hover:bg-accent"
            >
              <div className="rounded-lg bg-orange-100 p-2">
                <IconChartBar className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="font-medium">View Metrics</p>
                <p className="text-sm text-muted-foreground">
                  Check system performance statistics
                </p>
              </div>
            </Link>

            <Link
              to="/demo"
              className="flex items-center gap-3 rounded-md border p-4 transition-colors hover:bg-accent"
            >
              <div className="rounded-lg bg-purple-100 p-2">
                <IconDeviceGamepad className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="font-medium">Demo Controls</p>
                <p className="text-sm text-muted-foreground">
                  Spawn batches of test jobs
                </p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
