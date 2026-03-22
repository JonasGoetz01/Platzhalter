"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { Loader2Icon, CheckCircleIcon, AlertCircleIcon } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth"
import { toast } from "sonner"

export default function AcceptInvitationPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations("org")
  const invitationId = searchParams.get("id")

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [errorMsg, setErrorMsg] = useState("")

  useEffect(() => {
    if (!invitationId) {
      setStatus("error")
      setErrorMsg("Missing invitation ID")
      return
    }

    authClient.organization
      .acceptInvitation({ invitationId })
      .then(async ({ error }) => {
        if (error) {
          setStatus("error")
          setErrorMsg(error.message ?? t("invitationError"))
          return
        }
        setStatus("success")
        toast.success(t("invitationAccepted"))
        // Brief delay then redirect
        setTimeout(() => router.replace("/events"), 1500)
      })
      .catch(() => {
        setStatus("error")
        setErrorMsg(t("invitationError"))
      })
  }, [invitationId, router, t])

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>{t("acceptInvitation")}</CardTitle>
          {status === "loading" && (
            <CardDescription>{t("acceptingInvitation")}</CardDescription>
          )}
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {status === "loading" && (
            <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
          )}
          {status === "success" && (
            <>
              <CheckCircleIcon className="size-12 text-green-500" />
              <p className="text-sm text-muted-foreground">
                {t("invitationAccepted")}
              </p>
            </>
          )}
          {status === "error" && (
            <>
              <AlertCircleIcon className="size-12 text-destructive/50" />
              <p className="text-sm text-destructive">{errorMsg}</p>
              <Button variant="outline" onClick={() => router.replace("/events")}>
                {t("organizations")}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
