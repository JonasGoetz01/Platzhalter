"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { useTranslations, useLocale } from "next-intl"
import {
  ArrowLeftIcon,
  Loader2Icon,
  PencilIcon,
  Trash2Icon,
  UsersIcon,
  LayoutGridIcon,
  GroupIcon,
  FileDownIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

import { apiFetch } from "@/lib/api"
import { useSession } from "@/lib/auth"
import { toast } from "sonner"
import { migrateLayout } from "@/lib/floorplan"
import type { Event, Person, FloorPlan, Group } from "@/lib/types"

export default function EventDetailPage() {
  const t = useTranslations("events")
  const tc = useTranslations("common")
  const te = useTranslations("errors")
  const locale = useLocale()
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { data: session } = useSession()
  const isAdmin = (session?.user as any)?.role === "admin"
  const [event, setEvent] = useState<Event | null>(null)
  const [persons, setPersons] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const e = await apiFetch<Event>(`/events/${params.id}`)
      setEvent(e)
      const p = await apiFetch<Person[]>(`/events/${params.id}/persons`).catch(() => [])
      setPersons(p ?? [])
    } catch (err: any) {
      console.error("Failed to load event:", err)
      toast.error(te("eventNotFound"))
      router.replace("/events")
    } finally {
      setLoading(false)
    }
  }, [params.id, router, te])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  async function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)

    const form = new FormData(e.currentTarget)

    try {
      const updated = await apiFetch<Event>(`/events/${params.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: form.get("name"),
          event_date: form.get("date") || "",
          description: form.get("description") || "",
        }),
      })
      setEvent(updated)
      setEditing(false)
      toast.success(t("eventUpdated"))
    } catch (err: any) {
      toast.error(err.message ?? te("saveFailed"))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    try {
      await apiFetch(`/events/${params.id}`, { method: "DELETE" })
      toast.success(t("eventDeleted"))
      router.replace("/events")
    } catch (err: any) {
      toast.error(err.message ?? te("deleteFailed"))
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!event) return null

  const isPast = event.event_date ? new Date(event.event_date) < new Date() : false
  const seated = persons.filter((p) => p.table_ref && p.seat_ref)
  const parked = persons.filter((p) => !p.table_ref || !p.seat_ref)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" render={<Link href="/events" />}>
          <ArrowLeftIcon />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight truncate">
              {event.name}
            </h1>
            {isPast && <Badge variant="secondary">{t("past")}</Badge>}
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
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditing(true)}
            >
              <PencilIcon />
              <span className="hidden md:inline">{t("editEvent")}</span>
            </Button>
            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <Button variant="outline" size="sm">
                    <Trash2Icon />
                  </Button>
                }
              />
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("deleteEvent")}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("deleteEventDescription")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>
                    {t("deleteConfirm")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      {/* Edit dialog */}
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("editTitle")}</DialogTitle>
            <DialogDescription>
              {t("editDescription")}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">{t("eventName")}</Label>
              <Input
                id="edit-name"
                name="name"
                defaultValue={event.name}
                required
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-date">{t("eventDate")}</Label>
              <Input
                id="edit-date"
                name="date"
                type="date"
                defaultValue={event.event_date?.split("T")[0] ?? ""}
                required
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">{t("eventDescription")}</Label>
              <Textarea
                id="edit-description"
                name="description"
                defaultValue={event.description}
                rows={3}
                disabled={saving}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditing(false)}
              >
                {tc("cancel")}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2Icon className="animate-spin" />}
                {tc("save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Stats + Description */}
      <div className="grid grid-cols-3 gap-3 lg:grid-cols-4">
        <Card className="py-0">
          <CardContent className="flex items-center gap-3 px-4 py-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <UsersIcon className="size-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("totalGuests")}</p>
              <p className="text-2xl font-bold leading-none">{persons.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="py-0">
          <CardContent className="flex items-center gap-3 px-4 py-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <LayoutGridIcon className="size-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("seated")}</p>
              <p className="text-2xl font-bold leading-none">{seated.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="py-0">
          <CardContent className="flex items-center gap-3 px-4 py-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <UsersIcon className="size-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("notSeated")}</p>
              <p className="text-2xl font-bold leading-none">{parked.length}</p>
            </div>
          </CardContent>
        </Card>
        {event.description && (
          <Card className="col-span-3 py-0 lg:col-span-1 lg:row-span-1">
            <CardContent className="px-4 py-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">{t("eventDescription")}</p>
              <p className="text-sm text-foreground whitespace-pre-wrap line-clamp-3">
                {event.description}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {isAdmin && (
          <Link
            href={`/events/${params.id}/floorplan`}
            className="group flex flex-col items-center gap-2 rounded-xl border bg-primary p-4 text-primary-foreground transition-colors hover:bg-primary/90 lg:p-5"
          >
            <LayoutGridIcon className="size-6" />
            <span className="text-sm font-medium">{t("editLayout")}</span>
          </Link>
        )}
        <Link
          href={`/events/${params.id}/seating`}
          className={`group flex flex-col items-center gap-2 rounded-xl border p-4 transition-colors lg:p-5 ${
            isAdmin
              ? "bg-card hover:bg-accent hover:text-accent-foreground"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
          }`}
        >
          <UsersIcon className="size-6" />
          <span className="text-sm font-medium">{t("seating")}</span>
        </Link>
        <Link
          href={`/events/${params.id}/guests`}
          className="group flex flex-col items-center gap-2 rounded-xl border bg-card p-4 transition-colors hover:bg-accent hover:text-accent-foreground lg:p-5"
        >
          <UsersIcon className="size-6" />
          <span className="text-sm font-medium">{t("guestList")}</span>
        </Link>
        <Link
          href={`/events/${params.id}/groups`}
          className="group flex flex-col items-center gap-2 rounded-xl border bg-card p-4 transition-colors hover:bg-accent hover:text-accent-foreground lg:p-5"
        >
          <GroupIcon className="size-6" />
          <span className="text-sm font-medium">{t("groups")}</span>
        </Link>
        <button
          type="button"
          disabled={isExporting}
          className="group col-span-2 flex flex-col items-center gap-2 rounded-xl border bg-card p-4 transition-colors hover:bg-accent hover:text-accent-foreground lg:col-span-1 lg:p-5 disabled:opacity-50 disabled:pointer-events-none"
          onClick={async () => {
            setIsExporting(true)
            try {
              const [fp, groups] = await Promise.all([
                apiFetch<FloorPlan>(`/events/${params.id}/floorplan`),
                apiFetch<Group[]>(`/events/${params.id}/groups`),
              ])
              const { generateSeatingPDF } = await import(
                "@/components/floorplan/pdf-export"
              )
              const blob = await generateSeatingPDF(
                event!,
                migrateLayout(fp.layout as any),
                persons,
                groups ?? []
              )
              const url = URL.createObjectURL(blob)
              const a = document.createElement("a")
              a.href = url
              a.download = `${event!.name.replace(/[^a-zA-Z0-9äöüÄÖÜß ]/g, "")}_Sitzplan.pdf`
              a.click()
              URL.revokeObjectURL(url)
              toast.success(t("pdfExported"))
            } catch (err: any) {
              toast.error(err.message ?? te("pdfExportFailed"))
            } finally {
              setIsExporting(false)
            }
          }}
        >
          {isExporting ? (
            <Loader2Icon className="size-6 animate-spin" />
          ) : (
            <FileDownIcon className="size-6" />
          )}
          <span className="text-sm font-medium">{t("pdfExport")}</span>
        </button>
      </div>
    </div>
  )
}
