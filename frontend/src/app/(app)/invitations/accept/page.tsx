"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2Icon } from "lucide-react"

/**
 * Legacy accept-invitation route inside the (app) auth-guarded group.
 * Redirects to the public /accept-invitation route so unauthenticated
 * users can also reach the invitation acceptance flow.
 */
export default function LegacyAcceptInvitationPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const id = searchParams.get("id")
    const target = id ? `/accept-invitation?id=${id}` : "/accept-invitation"
    router.replace(target)
  }, [router, searchParams])

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
    </div>
  )
}
