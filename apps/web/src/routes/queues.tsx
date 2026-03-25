import { createFileRoute, Link } from "@tanstack/react-router"
import { useState, useEffect } from "react"
import { IconRefresh, IconDatabase, IconPlus } from "@tabler/icons-react"
import { Button } from "@workspace/ui/components/button"
import { getMetrics } from "../server/functions"

export const Route = createFileRoute("/queues")({
  component: QueuesPage,
  loader: async () => {
    const metrics = await getMetrics()
    return { metrics }
  },
})

function QueuesPage() {
  const { metrics: initialMetrics } = Route.useLoaderData()
  const [queueSize, setQueueSize] = useState<number>(initialMetrics.queue_size)

  const refreshQueue = async () => {
    const metrics = await getMetrics()
    setQueueSize(metrics.queue_size)
  }

  useEffect(() => {
    const interval = setInterval(refreshQueue, 2000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Queues</h1>
          <p className="text-sm text-muted-foreground">
            Queue configuration and monitoring
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refreshQueue}>
          <IconRefresh className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-md border p-4">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
              <IconDatabase className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">dymunim_jobs</h2>
              <p className="text-sm text-muted-foreground">Primary job queue</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Queue Size</span>
              <span className="font-medium">{queueSize} messages</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Type</span>
              <span className="font-medium">PGMQ</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Retention</span>
              <span className="font-medium">Until consumed</span>
            </div>
          </div>
        </div>

        <div className="rounded-md border p-4">
          <h2 className="mb-4 text-lg font-semibold">Queue Status</h2>
          <div className="space-y-4">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Queue Depth
                </span>
                <span className="text-sm font-medium">{queueSize}</span>
              </div>
              <div className="h-2 rounded-full bg-muted">
                <div
                  className="h-2 rounded-full bg-primary transition-all"
                  style={{
                    width: `${Math.min((queueSize / 100) * 100, 100)}%`,
                  }}
                />
              </div>
            </div>

            <div className="rounded-md bg-muted p-3">
              <p className="text-sm font-medium">How it works</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Jobs are queued in PGMQ and processed by workers. Each job has a
                visibility timeout that prevents it from being picked up by
                multiple workers simultaneously.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-md border p-4">
        <h2 className="mb-4 text-lg font-semibold">Job Registry</h2>
        <p className="text-sm text-muted-foreground">
          Registered job types and their handlers. Job types define the timeout,
          retry policy, and handler mapping for each job.
        </p>
        <div className="mt-4">
          <Link
            to="/jobs/new"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            <IconPlus className="h-4 w-4" />
            Create a job to see it in action
          </Link>
        </div>
      </div>
    </div>
  )
}
