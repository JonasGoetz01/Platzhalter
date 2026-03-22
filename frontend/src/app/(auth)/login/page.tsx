"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { authClient, signIn } from "@/lib/auth"
import { Loader2Icon } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const t = useTranslations("login")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<"credentials" | "two-factor">("credentials")
  const [twoFactorMode, setTwoFactorMode] = useState<"totp" | "backup">("totp")
  const [code, setCode] = useState("")

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const form = new FormData(e.currentTarget)
    const email = form.get("email") as string
    const password = form.get("password") as string

    const { data, error } = await signIn.email({
      email,
      password,
    })

    if (error) {
      setError(error.message ?? t("error"))
      setLoading(false)
      return
    }

    if ((data as { twoFactorRedirect?: boolean })?.twoFactorRedirect) {
      setStep("two-factor")
      setLoading(false)
      return
    }

    router.replace("/")
  }

  async function handleTwoFactor(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const result = twoFactorMode === "totp"
        ? await authClient.twoFactor.verifyTotp({ code })
        : await authClient.twoFactor.verifyBackupCode({ code })

      if (result.error) {
        setError(result.error.message ?? t("invalidCode"))
        setLoading(false)
        return
      }

      router.replace("/")
    } catch {
      setError(t("invalidCode"))
      setLoading(false)
    }
  }

  function handleBackToLogin() {
    setStep("credentials")
    setTwoFactorMode("totp")
    setCode("")
    setError(null)
  }

  if (step === "two-factor") {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-xl">{t("twoFactorTitle")}</CardTitle>
          <CardDescription>{t("twoFactorDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleTwoFactor} className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            {twoFactorMode === "totp" ? (
              <div className="space-y-2">
                <Label htmlFor="totp-code">{t("totpCode")}</Label>
                <Input
                  id="totp-code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder={t("totpPlaceholder")}
                  autoComplete="one-time-code"
                  required
                  disabled={loading}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="backup-code">{t("backupCode")}</Label>
                <Input
                  id="backup-code"
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder={t("backupCodePlaceholder")}
                  required
                  disabled={loading}
                />
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2Icon className="animate-spin" />}
              {t("verify")}
            </Button>

            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => {
                  setTwoFactorMode(twoFactorMode === "totp" ? "backup" : "totp")
                  setCode("")
                  setError(null)
                }}
                className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
              >
                {twoFactorMode === "totp" ? t("useBackupCode") : t("useAuthenticator")}
              </button>
              <button
                type="button"
                onClick={handleBackToLogin}
                className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
              >
                {t("backToLogin")}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl">{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">{t("email")}</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="name@example.com"
              autoComplete="email"
              required
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t("password")}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder={t("passwordPlaceholder")}
              autoComplete="current-password"
              required
              disabled={loading}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2Icon className="animate-spin" />}
            {t("submit")}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            {t("noAccount")}{" "}
            <Link href="/register" className="text-primary hover:underline">
              {t("register")}
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
