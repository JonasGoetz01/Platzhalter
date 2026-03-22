"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
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
import { authClient, useSession } from "@/lib/auth"
import { toast } from "sonner"

export default function AcceptInvitationPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations("org")
  const { data: session, isPending } = useSession()
  const invitationId = searchParams.get("id")

  const [status, setStatus] = useState<"loading" | "waiting" | "success" | "error">("loading")
  const [errorMsg, setErrorMsg] = useState("")

  useEffect(() => {
    if (isPending) return

    if (!invitationId) {
      setStatus("error")
      setErrorMsg(t("invitationMissingId"))
      return
    }

    if (!session) {
      setStatus("waiting")
      return
    }

    // User is logged in — accept the invitation
    authClient.organization
      .acceptInvitation({ invitationId })
      .then(({ error }) => {
        if (error) {
          setStatus("error")
          setErrorMsg(error.message ?? t("invitationError"))
          return
        }
        setStatus("success")
        toast.success(t("invitationAccepted"))
        setTimeout(() => router.replace("/events"), 1500)
      })
      .catch(() => {
        setStatus("error")
        setErrorMsg(t("invitationError"))
      })
  }, [invitationId, session, isPending, router, t])

  // Still checking session
  if (isPending || (status === "loading" && session)) {
    return (
      <Card className="w-full">
        <CardHeader className="text-center">
          <CardTitle>{t("acceptInvitation")}</CardTitle>
          <CardDescription>{t("acceptingInvitation")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  // Not logged in — show login/register prompt
  if (status === "waiting") {
    return (
      <Card className="w-full">
        <CardHeader className="text-center">
          <CardTitle>{t("acceptInvitation")}</CardTitle>
          <CardDescription>{t("loginRequiredForInvitation")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button className="w-full" render={<Link href={`/login?invite=${invitationId}`} />}>
            {t("loginToAccept")}
          </Button>
          <Button variant="outline" className="w-full" render={<Link href={`/register?invite=${invitationId}`} />}>
            {t("registerToAccept")}
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Success
  if (status === "success") {
    return (
      <Card className="w-full">
        <CardHeader className="text-center">
          <CardTitle>{t("acceptInvitation")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <CheckCircleIcon className="size-12 text-green-500" />
          <p className="text-sm text-muted-foreground">
            {t("invitationAccepted")}
          </p>
        </CardContent>
      </Card>
    )
  }

  // Error
  return (
    <Card className="w-full">
      <CardHeader className="text-center">
        <CardTitle>{t("acceptInvitation")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <AlertCircleIcon className="size-12 text-destructive/50" />
        <p className="text-sm text-destructive">{errorMsg}</p>
        <Button variant="outline" render={<Link href="/events" />}>
          {t("goToEvents")}
        </Button>
      </CardContent>
    </Card>
  )
}
