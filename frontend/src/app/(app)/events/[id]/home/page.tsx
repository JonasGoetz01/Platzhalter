"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { useTranslations, useLocale } from "next-intl"
import {
  ArrowLeftIcon,
  Loader2Icon,
  PencilIcon,
  PlayIcon,
  Trash2Icon,
  UsersIcon,
  CheckCircle2Icon,
  CircleAlertIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { apiFetch } from "@/lib/api"
import { useSession } from "@/lib/auth"
import { toast } from "sonner"
import type { Event, Person } from "@/lib/types"

export default function HomePage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations("events")
  const tc = useTranslations("common")
  const te = useTranslations("errors")
  const { data: session } = useSession()
  const isAdmin = (session?.user as any)?.role === "admin"

  const [event, setEvent] = useState<Event | null>(null)
  const [persons, setPersons] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)

  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false)
  const [editName, setEditName] = useState("")
  const [editDate, setEditDate] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [saving, setSaving] = useState(false)

  // Delete dialog state
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const fetchData = useCallback(() => {
    setLoading(true)
    Promise.all([
      apiFetch<Event>(`/events/${params.id}`),
      apiFetch<Person[]>(`/events/${params.id}/persons`),
    ])
      .then(([ev, p]) => {
        setEvent(ev)
        setPersons(p ?? [])
      })
      .catch(() => {
        toast.error(te("eventLoadFailed"))
      })
      .finally(() => setLoading(false))
  }, [params.id, te])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const totalGuests = persons.length
  const seatedCount = persons.filter(
    (p) => p.table_ref && p.seat_ref
  ).length
  const notSeatedCount = totalGuests - seatedCount

  function openEditDialog() {
    if (!event) return
    setEditName(event.name)
    setEditDate(event.event_date ?? "")
    setEditDescription(event.description ?? "")
    setEditOpen(true)
  }

  async function handleEditSave() {
    if (!event) return
    setSaving(true)
    try {
      const updated = await apiFetch<Event>(`/events/${event.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: editName,
          event_date: editDate || null,
          description: editDescription,
        }),
      })
      setEvent(updated)
      setEditOpen(false)
      toast.success(t("eventUpdated"))
    } catch (err: any) {
      toast.error(err.message ?? te("saveFailed"))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!event) return
    setDeleting(true)
    try {
      await apiFetch(`/events/${event.id}`, { method: "DELETE" })
      toast.success(t("eventDeleted"))
      router.push("/events")
    } catch (err: any) {
      toast.error(err.message ?? te("deleteFailed"))
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!event) {
    return (
      <div className="flex flex-col items-center gap-4 py-24">
        <CircleAlertIcon className="size-12 text-muted-foreground/50" />
        <p className="text-muted-foreground">{te("eventNotFound")}</p>
        <Button variant="outline" render={<Link href="/events" />}>
          <ArrowLeftIcon />
          {tc("back")}
        </Button>
      </div>
    )
  }

  const isPast = event.event_date
    ? new Date(event.event_date) < new Date()
    : false

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="mt-0.5 shrink-0"
          render={<Link href="/events" />}
        >
          <ArrowLeftIcon />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight truncate">
              {event.name}
            </h1>
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
        </div>
        {isAdmin && (
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 mt-0.5"
            onClick={openEditDialog}
          >
            <PencilIcon />
          </Button>
        )}
      </div>

      {/* Description */}
      {event.description && (
        <p className="text-sm text-muted-foreground leading-relaxed">
          {event.description}
        </p>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="flex flex-col items-center gap-1 py-4 px-2 text-center">
            <UsersIcon className="size-5 text-primary" />
            <span className="text-2xl font-bold tabular-nums">
              {totalGuests}
            </span>
            <span className="text-xs text-muted-foreground leading-tight">
              {t("totalGuests")}
            </span>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col items-center gap-1 py-4 px-2 text-center">
            <CheckCircle2Icon className="size-5 text-green-600 dark:text-green-400" />
            <span className="text-2xl font-bold tabular-nums">
              {seatedCount}
            </span>
            <span className="text-xs text-muted-foreground leading-tight">
              {t("seated")}
            </span>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col items-center gap-1 py-4 px-2 text-center">
            <CircleAlertIcon className="size-5 text-amber-600 dark:text-amber-400" />
            <span className="text-2xl font-bold tabular-nums">
              {notSeatedCount}
            </span>
            <span className="text-xs text-muted-foreground leading-tight">
              {t("notSeated")}
            </span>
          </CardContent>
        </Card>
      </div>

      {/* CTA Button */}
      <Button
        size="lg"
        className="w-full h-12 text-base"
        render={<Link href={`/events/${params.id}/planner`} />}
      >
        <PlayIcon className="size-5" />
        {t("startPlacement")}
      </Button>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("editTitle")}</DialogTitle>
            <DialogDescription>{t("editDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">{t("eventName")}</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-date">{t("eventDate")}</Label>
              <Input
                id="edit-date"
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">{t("eventDescription")}</Label>
              <Textarea
                id="edit-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                disabled={saving}
              />
            </div>
          </div>
          <DialogFooter className="flex-row gap-2">
            <Button
              type="button"
              variant="destructive"
              className="mr-auto"
              onClick={() => {
                setEditOpen(false)
                setDeleteOpen(true)
              }}
            >
              <Trash2Icon className="size-4" />
              <span className="hidden sm:inline">{tc("delete")}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditOpen(false)}
            >
              {tc("cancel")}
            </Button>
            <Button
              type="button"
              disabled={saving || !editName.trim()}
              onClick={handleEditSave}
            >
              {saving && <Loader2Icon className="animate-spin" />}
              {tc("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteEvent")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteEventDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>
              {tc("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting && <Loader2Icon className="animate-spin" />}
              {t("deleteConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
