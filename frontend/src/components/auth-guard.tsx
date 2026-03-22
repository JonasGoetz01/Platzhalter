"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "@/lib/auth"
import { Loader2Icon } from "lucide-react"

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (!isPending && !session) {
      router.replace("/login")
    }
  }, [isPending, session, router])

  if (isPending || !session) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return <>{children}</>
}
