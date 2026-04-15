import { HeadContent, Link, Scripts, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import appCss from "../styles.css?url";
import { AuthProvider, useAuth } from "@/lib/auth-context";

const queryClient = new QueryClient();

function NotFoundComponent() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center">
        <h1 className="text-6xl font-bold mb-4 text-gray-900">404</h1>
        <p className="text-2xl font-semibold text-gray-700 mb-2">Page Not Found</p>
        <p className="text-gray-600 mb-8">The page you are looking for does not exist.</p>
        <a
          href="/"
          className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Go Home
        </a>
      </div>
    </div>
  );
}

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
        title: "TanStack Start Starter",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),

  shellComponent: RootDocument,
  notFoundComponent: NotFoundComponent,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <AppShell>{children}</AppShell>
            <TanStackDevtools
              config={{
                position: "bottom-right",
              }}
              plugins={[
                {
                  name: "Tanstack Router",
                  render: <TanStackRouterDevtoolsPanel />,
                },
              ]}
            />
          </AuthProvider>
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  return (
    <>
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 p-4">
          <nav className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link
              to="/"
              activeProps={{ className: "active" }}
              className="transition-colors hover:text-foreground [&.active]:font-bold [&.active]:text-foreground"
            >
              Dashboard
            </Link>
            <Link
              to="/leaderboard"
              activeProps={{ className: "active" }}
              className="transition-colors hover:text-foreground [&.active]:font-bold [&.active]:text-foreground"
            >
              Leaderboard
            </Link>
            <Link
              to="/profile"
              activeProps={{ className: "active" }}
              className="transition-colors hover:text-foreground [&.active]:font-bold [&.active]:text-foreground"
            >
              Profile
            </Link>
          </nav>

          {user ? (
            <div className="text-right text-sm">
              <p className="font-medium text-foreground">{user.username}</p>
              <p className="text-muted-foreground">Balance: ${user.balance.toFixed(2)}</p>
            </div>
          ) : null}
        </div>
      </header>
      {children}
    </>
  );
}
