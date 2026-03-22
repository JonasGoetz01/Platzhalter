"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import Link from "next/link"
import { ArrowLeftIcon, Loader2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { apiFetch } from "@/lib/api"
import { toast } from "sonner"
import type { Event } from "@/lib/types"

export default function NewEventPage() {
  const router = useRouter()
  const t = useTranslations("events")
  const tc = useTranslations("common")
  const te = useTranslations("errors")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)

    const form = new FormData(e.currentTarget)

    try {
      const event = await apiFetch<Event>("/events", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          event_date: form.get("date") || "",
          description: form.get("description") || "",
        }),
      })
      toast.success(t("eventCreated"))
      router.push(`/events/${event.id}`)
    } catch (err: any) {
      toast.error(err.message ?? te("createFailed"))
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" render={<Link href="/events" />}>
          <ArrowLeftIcon />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t("newEventTitle")}
          </h1>
          <p className="text-muted-foreground">
            {t("newEventSubtitle")}
          </p>
        </div>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>{t("details")}</CardTitle>
          <CardDescription>
            {t("detailsDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t("eventName")}</Label>
              <Input
                id="name"
                name="name"
                placeholder={t("namePlaceholder")}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">{t("eventDate")}</Label>
              <Input
                id="date"
                name="date"
                type="date"
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">{t("descriptionOptional")}</Label>
              <Textarea
                id="description"
                name="description"
                placeholder={t("descriptionPlaceholder")}
                rows={3}
                disabled={loading}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={loading}>
                {loading && <Loader2Icon className="animate-spin" />}
                {tc("create")}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={loading}
              >
                {tc("cancel")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
