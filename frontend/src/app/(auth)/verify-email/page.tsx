"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { useTranslations } from "next-intl"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircleIcon, Loader2Icon, XCircleIcon } from "lucide-react"

export default function VerifyEmailPage() {
  const t = useTranslations("verifyEmail")
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")

  useEffect(() => {
    if (!token) {
      setStatus("error")
      return
    }

    const params = new URLSearchParams({ token })
    fetch(`/api/auth/verify-email?${params.toString()}`, {
      method: "GET",
      credentials: "include",
      redirect: "manual",
    })
      .then((res) => {
        if (res.ok || res.type === "opaqueredirect") {
          setStatus("success")
        } else {
          setStatus("error")
        }
      })
      .catch(() => {
        setStatus("error")
      })
  }, [token])

  return (
    <Card className="w-full">
      <CardHeader className="items-center text-center">
        {status === "loading" && (
          <>
            <Loader2Icon className="mb-2 size-10 animate-spin text-muted-foreground" />
            <CardTitle className="text-xl">{t("title")}</CardTitle>
            <CardDescription>{t("verifying")}</CardDescription>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircleIcon className="mb-2 size-10 text-green-600" />
            <CardTitle className="text-xl">{t("verified")}</CardTitle>
            <CardDescription>{t("verifiedDescription")}</CardDescription>
          </>
        )}
        {status === "error" && (
          <>
            <XCircleIcon className="mb-2 size-10 text-destructive" />
            <CardTitle className="text-xl">{t("error")}</CardTitle>
            <CardDescription>{t("errorDescription")}</CardDescription>
          </>
        )}
      </CardHeader>
      {status !== "loading" && (
        <CardContent>
          <Link href="/login" className="block">
            <Button variant="outline" className="w-full">
              {t("backToLogin")}
            </Button>
          </Link>
        </CardContent>
      )}
    </Card>
  )
}
