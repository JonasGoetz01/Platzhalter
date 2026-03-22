"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useTranslations, useLocale } from "next-intl"
import {
  PlusIcon,
  CalendarDaysIcon,
  Loader2Icon,
  SearchIcon,
  AlertCircleIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { apiFetch } from "@/lib/api"
import type { Event } from "@/lib/types"

export default function EventsPage() {
  const t = useTranslations("events")
  const tc = useTranslations("common")
  const locale = useLocale()
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [error, setError] = useState<string | null>(null)

  const fetchEvents = useCallback(() => {
    setError(null)
    setLoading(true)
    apiFetch<Event[]>("/events")
      .then(setEvents)
      .catch(() => setError("Failed to load events"))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  const filtered = events.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase())
  )

  const now = new Date()

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t("title")}
          </h1>
          <p className="text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
                <Button render={<Link href="/events/new" />}>
          <PlusIcon />
          {t("newEvent")}
        </Button>
      </div>

      {events.length > 0 && (
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <AlertCircleIcon className="size-12 text-destructive/50" />
            <div className="text-center">
              <p className="font-medium text-destructive">{error}</p>
            </div>
            <Button variant="outline" onClick={fetchEvents}>
              {t("retry") ?? "Retry"}
            </Button>
          </CardContent>
        </Card>
      ) : filtered.length > 0 ? (
        <div className="grid gap-3">
          {filtered
            .sort(
              (a, b) =>
                new Date(b.event_date ?? "").getTime() - new Date(a.event_date ?? "").getTime()
            )
            .map((event) => {
              const isPast = event.event_date ? new Date(event.event_date) < now : false
              return (
                <Link key={event.id} href={`/events/${event.id}`}>
                  <Card className="transition-colors hover:bg-accent/50">
                    <CardContent className="flex items-center gap-4 p-4">
                      <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                        <CalendarDaysIcon className="size-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">{event.name}</p>
                          {isPast && (
                            <Badge variant="secondary" className="shrink-0">
                              {t("past")}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {event.event_date
                          ? new Date(event.event_date).toLocaleDateString(locale, {
                              weekday: "long",
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })
                          : t("noDate")}
                        </p>
                        {event.description && (
                          <p className="mt-1 text-sm text-muted-foreground truncate">
                            {event.description}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
        </div>
      ) : events.length > 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          {t("noResults")}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <CalendarDaysIcon className="size-12 text-muted-foreground/50" />
            <div className="text-center">
              <p className="font-medium">{t("noEvents")}</p>
              <p className="text-sm text-muted-foreground">
                {t("noEventsDescription")}
              </p>
            </div>
            <Button render={<Link href="/events/new" />}>
              <PlusIcon />
              {t("createEvent")}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
