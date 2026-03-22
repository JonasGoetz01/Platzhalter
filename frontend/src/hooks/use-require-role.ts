"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "@/lib/auth"

/**
 * Redirect if current user does not have one of the allowed roles.
 * Returns { loading, allowed } so the page can show a spinner while checking.
 */
export function useRequireRole(roles: string[]) {
  const { data: session, isPending } = useSession()
  const router = useRouter()

  const role = (session?.user as any)?.role as string | undefined
  const allowed = !isPending && !!role && roles.includes(role)

  useEffect(() => {
    if (!isPending && !allowed) {
      router.replace("/events")
    }
  }, [isPending, allowed, router])

  return { loading: isPending, allowed }
}
