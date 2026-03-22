import { AuthGuard } from "@/components/auth-guard"
import { TopBar } from "@/components/top-bar"
import { OrgProvider } from "@/lib/org-context"

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthGuard>
      <OrgProvider>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-background focus:text-foreground focus:rounded-md focus:shadow-lg focus:ring-2 focus:ring-ring"
        >
          Skip to content
        </a>
        <TopBar />
        <main id="main-content" className="flex-1 flex flex-col">
          {children}
        </main>
      </OrgProvider>
    </AuthGuard>
  )
}
