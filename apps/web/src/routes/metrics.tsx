import { createFileRoute } from "@tanstack/react-router"
import { useState, useEffect } from "react"
import { IconRefresh } from "@tabler/icons-react"
import { Button } from "@workspace/ui/components/button"
import { getMetrics, type Metrics } from "../server/functions"

export const Route = createFileRoute("/metrics")({
  component: MetricsPage,
  loader: async () => {
    const metrics = await getMetrics()
    return { metrics }
  },
})

function MetricsPage() {
  const { metrics: initialMetrics } = Route.useLoaderData()
  const [metrics, setMetrics] = useState<Metrics>(initialMetrics)

  const refreshMetrics = async () => {
    const updated = await getMetrics()
    setMetrics(updated)
  }

  useEffect(() => {
    const interval = setInterval(refreshMetrics, 3000)
    return () => clearInterval(interval)
  }, [])

  const stats = [
    { label: "Total Jobs", value: metrics.jobs_total, color: "bg-gray-500" },
    { label: "Pending", value: metrics.jobs_pending, color: "bg-yellow-500" },
    { label: "Running", value: metrics.jobs_running, color: "bg-blue-500" },
    {
      label: "Completed",
      value: metrics.jobs_completed,
      color: "bg-green-500",
    },
    { label: "Failed", value: metrics.jobs_failed, color: "bg-red-500" },
  ]

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Metrics</h1>
          <p className="text-sm text-muted-foreground">
            System performance and job statistics
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refreshMetrics}>
          <IconRefresh className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-md border p-4">
            <div className={`mb-2 h-1 w-8 rounded-full ${stat.color}`} />
            <p className="text-sm text-muted-foreground">{stat.label}</p>
            <p className="text-2xl font-bold">{stat.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-md border p-4">
          <h2 className="mb-4 text-lg font-semibold">Queue Status</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Queue Size</span>
              <span className="font-medium">{metrics.queue_size}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">
                Active Workers
              </span>
              <span className="font-medium">{metrics.workers_active}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">
                Avg Duration
              </span>
              <span className="font-medium">
                {metrics.avg_duration_ms
                  ? `${metrics.avg_duration_ms.toFixed(0)}ms`
                  : "N/A"}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-md border p-4">
          <h2 className="mb-4 text-lg font-semibold">Job Distribution</h2>
          <div className="space-y-3">
            {metrics.jobs_total > 0 ? (
              <>
                <div>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>Success Rate</span>
                    <span>
                      {(
                        (metrics.jobs_completed / metrics.jobs_total) *
                        100
                      ).toFixed(1)}
                      %
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-green-500 transition-all"
                      style={{
                        width: `${(metrics.jobs_completed / metrics.jobs_total) * 100}%`,
                      }}
                    />
                  </div>
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>Failure Rate</span>
                    <span>
                      {(
                        (metrics.jobs_failed / metrics.jobs_total) *
                        100
                      ).toFixed(1)}
                      %
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-red-500 transition-all"
                      style={{
                        width: `${(metrics.jobs_failed / metrics.jobs_total) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No jobs processed yet
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
