import { createFileRoute, Link } from "@tanstack/react-router"
import { useState, useCallback } from "react"
import {
  IconRefresh,
  IconActivity,
  IconWifi,
  IconWifiOff,
  IconEye,
} from "@tabler/icons-react"
import { Button } from "@workspace/ui/components/button"
import { listWorkers, type Worker } from "../server/functions"
import { useWebSocket } from "../hooks/useWebSocket"

export const Route = createFileRoute("/workers")({
  component: WorkersPage,
  loader: async () => {
    const workers = await listWorkers()
    return { workers }
  },
})

function WorkersPage() {
  const { workers: initialWorkers } = Route.useLoaderData()
  const [workers, setWorkers] = useState<Worker[]>(initialWorkers)

  const refreshWorkers = async () => {
    const updated = await listWorkers()
    setWorkers(updated)
  }

  const handleWebSocketMessage = useCallback((data: { type: string }) => {
    if (
      data.type === "worker_heartbeat" ||
      data.type === "job_completed" ||
      data.type === "job_failed"
    ) {
      refreshWorkers()
    }
  }, [])

  const { isConnected } = useWebSocket({
    url: `ws://${typeof window !== "undefined" ? window.location.hostname : "localhost"}:3001`,
    onMessage: handleWebSocketMessage,
  })

  const getStatusStyles = (status: string) => {
    switch (status) {
      case "busy":
        return "bg-blue-500/10 text-blue-700 border-blue-500/20"
      case "idle":
        return "bg-green-500/10 text-green-700 border-green-500/20"
      default:
        return "bg-gray-500/10 text-gray-700 border-gray-500/20"
    }
  }

  const isStale = (heartbeat: string) => {
    const lastBeat = new Date(heartbeat)
    const now = new Date()
    const diffMs = now.getTime() - lastBeat.getTime()
    return diffMs > 30000 // 30 seconds
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Workers</h1>
          <p className="text-sm text-muted-foreground">
            Active worker instances and their status
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
          <Button variant="outline" size="sm" onClick={refreshWorkers}>
            <IconRefresh className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {workers.length === 0 ? (
          <div className="col-span-full rounded-md border p-8 text-center">
            <IconActivity className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">No active workers</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Start a worker to process jobs
            </p>
          </div>
        ) : (
          workers.map((worker) => (
            <div
              key={worker.worker_id}
              className={`rounded-md border p-4 ${isStale(worker.last_heartbeat) ? "opacity-50" : ""}`}
            >
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <h3 className="font-mono text-sm font-medium">
                    {worker.worker_id.slice(0, 20)}...
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Started: {new Date(worker.started_at).toLocaleString()}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getStatusStyles(worker.status)}`}
                >
                  {worker.status}
                </span>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Jobs Processed</span>
                  <span className="font-medium">{worker.jobs_processed}</span>
                </div>
                {worker.current_job_id && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Current Job</span>
                    <Link
                      to="/jobs/$jobId"
                      params={{ jobId: String(worker.current_job_id) }}
                      className="inline-flex items-center gap-1 font-mono font-medium text-primary hover:underline"
                    >
                      #{worker.current_job_id}
                      <IconEye className="h-3 w-3" />
                    </Link>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last Heartbeat</span>
                  <span
                    className={
                      isStale(worker.last_heartbeat) ? "text-red-500" : ""
                    }
                  >
                    {new Date(worker.last_heartbeat).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
