"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
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
import { authClient } from "@/lib/auth"
import { toast } from "sonner"
import { Loader2Icon } from "lucide-react"

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

export default function NewOrganizationPage() {
  const router = useRouter()
  const t = useTranslations("org")
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [slugManual, setSlugManual] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleNameChange(value: string) {
    setName(value)
    if (!slugManual) {
      setSlug(slugify(value))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { data, error: createError } = await authClient.organization.create({
        name,
        slug: slug || slugify(name),
      })

      if (createError) {
        setError(createError.message ?? "Failed to create organization")
        setLoading(false)
        return
      }

      if (data?.id) {
        await authClient.organization.setActive({ organizationId: data.id })
      }

      toast.success(t("created"))
      router.replace("/events")
    } catch {
      setError("Failed to create organization")
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t("createTitle")}</CardTitle>
          <CardDescription>{t("createDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="org-name">{t("name")}</Label>
              <Input
                id="org-name"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder={t("namePlaceholder")}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-slug">{t("slug")}</Label>
              <Input
                id="org-slug"
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value)
                  setSlugManual(true)
                }}
                placeholder="my-org"
                required
                disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading || !name}>
              {loading && <Loader2Icon className="animate-spin" />}
              {t("create")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
