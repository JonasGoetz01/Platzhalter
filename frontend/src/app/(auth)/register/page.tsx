"use client"

import { useState } from "react"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { signUp } from "@/lib/auth"
import { Loader2Icon, MailIcon } from "lucide-react"

export default function RegisterPage() {
  const searchParams = useSearchParams()
  const t = useTranslations("register")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [registered, setRegistered] = useState(false)

  const inviteId = searchParams.get("invite")

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const form = new FormData(e.currentTarget)
    const name = form.get("name") as string
    const email = form.get("email") as string
    const password = form.get("password") as string
    const confirmPassword = form.get("confirmPassword") as string

    if (password !== confirmPassword) {
      setError(t("passwordMismatch"))
      return
    }

    setLoading(true)

    const { error } = await signUp.email({
      email,
      password,
      name,
    })

    if (error) {
      setError(error.message ?? t("error"))
      setLoading(false)
      return
    }

    setLoading(false)
    setRegistered(true)
  }

  if (registered) {
    return (
      <Card className="w-full">
        <CardHeader className="items-center text-center">
          <MailIcon className="mb-2 size-10 text-muted-foreground" />
          <CardTitle className="text-xl">{t("checkEmail")}</CardTitle>
          <CardDescription>{t("checkEmailDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href={inviteId ? `/login?invite=${inviteId}` : "/login"} className="block">
            <Button variant="outline" className="w-full">
              {t("login")}
            </Button>
          </Link>
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
            <Label htmlFor="name">{t("name")}</Label>
            <Input
              id="name"
              name="name"
              type="text"
              placeholder={t("namePlaceholder")}
              autoComplete="name"
              required
              disabled={loading}
            />
          </div>
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
              autoComplete="new-password"
              required
              minLength={8}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t("confirmPassword")}</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              placeholder={t("confirmPasswordPlaceholder")}
              autoComplete="new-password"
              required
              minLength={8}
              disabled={loading}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2Icon className="animate-spin" />}
            {t("submit")}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            {t("hasAccount")}{" "}
            <Link href={inviteId ? `/login?invite=${inviteId}` : "/login"} className="text-primary hover:underline">
              {t("login")}
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
