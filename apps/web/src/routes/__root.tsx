import {
  HeadContent,
  Link,
  Scripts,
  createRootRoute,
  Outlet,
} from "@tanstack/react-router"
import {
  IconChartBar,
  IconStack,
  IconList,
  IconUsers,
  IconDeviceGamepad,
} from "@tabler/icons-react"

import appCss from "@workspace/ui/globals.css?url"

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "Dymunim - Job Queue System",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen bg-background">
        <div className="flex h-screen">
          <nav className="flex w-64 flex-col border-r bg-muted/40">
            <div className="border-b p-6">
              <h1 className="text-xl font-bold">Dymunim</h1>
              <p className="mt-1 text-xs text-muted-foreground">
                Postgres-Native Queue
              </p>
            </div>
            <div className="flex-1 space-y-2 p-4">
              <NavLink to="/jobs" icon={<IconList className="h-4 w-4" />}>
                Jobs
              </NavLink>
              <NavLink to="/workers" icon={<IconUsers className="h-4 w-4" />}>
                Workers
              </NavLink>
              <NavLink to="/queues" icon={<IconStack className="h-4 w-4" />}>
                Queues
              </NavLink>
              <NavLink
                to="/metrics"
                icon={<IconChartBar className="h-4 w-4" />}
              >
                Metrics
              </NavLink>
              <div className="my-2 border-t" />
              <NavLink
                to="/demo"
                icon={<IconDeviceGamepad className="h-4 w-4" />}
              >
                Demo
              </NavLink>
            </div>
          </nav>
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>
        <Scripts />
      </body>
    </html>
  )
}

function NavLink({
  to,
  icon,
  children,
}: {
  to: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground [&.active]:bg-accent [&.active]:text-accent-foreground"
    >
      {icon}
      {children}
    </Link>
  )
}
