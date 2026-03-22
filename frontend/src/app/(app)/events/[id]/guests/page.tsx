"use client"

import { useEffect, useState, useCallback, useMemo, useRef } from "react"
import { useParams } from "next/navigation"
import { useTranslations } from "next-intl"
import {
  Loader2Icon,
  PlusIcon,
  Trash2Icon,
  PencilIcon,
  SearchIcon,
  UserIcon,
  XIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
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
import { toast } from "sonner"
import type { Person } from "@/lib/types"

export default function GuestsPage() {
  const t = useTranslations("guests")
  const tc = useTranslations("common")
  const te = useTranslations("errors")
  const params = useParams<{ id: string }>()

  const [persons, setPersons] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  // Quick-add form state
  const [quickName, setQuickName] = useState("")
  const [quickTable, setQuickTable] = useState("")
  const [adding, setAdding] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editPerson, setEditPerson] = useState<Person | null>(null)
  const [saving, setSaving] = useState(false)
  const editCounter = useRef(0)

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<Person | null>(null)

  // ── Data fetching ──────────────────────────────────────────

  const fetchData = useCallback(() => {
    apiFetch<Person[]>(`/events/${params.id}/persons`)
      .then((p) => setPersons(p ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [params.id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Focus name input on mount
  useEffect(() => {
    if (!loading) {
      nameInputRef.current?.focus()
    }
  }, [loading])

  // ── Derived data ───────────────────────────────────────────

  const filtered = useMemo(() => {
    const term = search.toLowerCase()
    const list = term
      ? persons.filter((p) => p.name.toLowerCase().includes(term))
      : persons
    return [...list].sort((a, b) => a.name.localeCompare(b.name))
  }, [persons, search])

  // ── Quick-add handler ──────────────────────────────────────

  async function handleQuickAdd(e: React.FormEvent) {
    e.preventDefault()
    const name = quickName.trim()
    if (!name) return

    setAdding(true)
    try {
      const created = await apiFetch<Person>(
        `/events/${params.id}/persons`,
        {
          method: "POST",
          body: JSON.stringify({
            name,
            booked_table: quickTable.trim() || null,
          }),
        }
      )
      setPersons((prev) => [...prev, created])
      setQuickName("")
      setQuickTable("")
      toast.success(t("guestAdded"))
      nameInputRef.current?.focus()
    } catch (err: any) {
      toast.error(err.message ?? te("createFailed"))
    } finally {
      setAdding(false)
    }
  }

  // ── Edit dialog handlers ───────────────────────────────────

  function openEdit(person: Person) {
    editCounter.current++
    setEditPerson(person)
    setEditDialogOpen(true)
  }

  async function handleEditSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editPerson) return
    setSaving(true)

    const form = new FormData(e.currentTarget)
    const bookedRaw = (form.get("booked_table") as string)?.trim() || null

    try {
      const updated = await apiFetch<Person>(`/persons/${editPerson.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: form.get("name"),
          booked_table: bookedRaw,
        }),
      })
      setPersons((prev) =>
        prev.map((p) => (p.id === updated.id ? updated : p))
      )
      toast.success(t("guestUpdated"))
      setEditDialogOpen(false)
    } catch (err: any) {
      toast.error(err.message ?? te("saveFailed"))
    } finally {
      setSaving(false)
    }
  }

  // ── Delete handler ─────────────────────────────────────────

  async function handleDelete(personId: string) {
    try {
      await apiFetch(`/persons/${personId}`, { method: "DELETE" })
      setPersons((prev) => prev.filter((p) => p.id !== personId))
      toast.success(t("guestRemoved"))
      setDeleteTarget(null)
      setEditDialogOpen(false)
    } catch (err: any) {
      toast.error(err.message ?? te("deleteFailed"))
    }
  }

  // ── Loading state ──────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2Icon className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="space-y-4 p-4">
      {/* Header with guest count */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">
          {t("count", { count: persons.length })}
        </p>
      </div>

      {/* Quick-add form */}
      <form onSubmit={handleQuickAdd} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1 min-w-0">
          <Label htmlFor="quick-name" className="sr-only">
            {tc("name")}
          </Label>
          <Input
            ref={nameInputRef}
            id="quick-name"
            placeholder={t("namePlaceholder")}
            value={quickName}
            onChange={(e) => setQuickName(e.target.value)}
            disabled={adding}
            autoComplete="off"
          />
        </div>
        <div className="sm:w-40">
          <Label htmlFor="quick-table" className="sr-only">
            {t("bookedTable")}
          </Label>
          <Input
            id="quick-table"
            placeholder={t("bookedTablePlaceholder")}
            value={quickTable}
            onChange={(e) => setQuickTable(e.target.value)}
            disabled={adding}
            autoComplete="off"
          />
        </div>
        <Button type="submit" disabled={adding || !quickName.trim()}>
          {adding ? (
            <Loader2Icon className="animate-spin" />
          ) : (
            <PlusIcon />
          )}
          <span className="sm:hidden">{t("addGuest")}</span>
        </Button>
      </form>

      {/* Search bar */}
      {persons.length > 0 && (
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
          {search && (
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setSearch("")}
            >
              <XIcon className="size-4" />
            </button>
          )}
        </div>
      )}

      {/* Guest list */}
      {filtered.length > 0 ? (
        <div className="divide-y divide-border rounded-lg border">
          {filtered.map((person) => {
            const isSeated = !!(person.table_ref && person.seat_ref)

            return (
              <div
                key={person.id}
                className="flex items-center gap-3 px-3 py-2.5 active:bg-accent transition-colors cursor-pointer"
                role="button"
                tabIndex={0}
                onClick={() => openEdit(person)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    openEdit(person)
                  }
                }}
              >
                {/* Avatar */}
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
                  <UserIcon className="size-4 text-muted-foreground" />
                </div>

                {/* Name */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{person.name}</p>
                </div>

                {/* Badges */}
                <div className="flex shrink-0 items-center gap-1.5">
                  {person.booked_table && (
                    <Badge variant="secondary" className="text-[10px]">
                      {person.booked_table}
                    </Badge>
                  )}
                  {isSeated ? (
                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900 dark:text-green-300 text-[10px]">
                      {t("seated")}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">
                      {t("notSeated")}
                    </Badge>
                  )}
                </div>

                {/* Edit icon hint (desktop) */}
                <PencilIcon className="hidden sm:block size-4 shrink-0 text-muted-foreground" />
              </div>
            )
          })}
        </div>
      ) : persons.length === 0 ? (
        /* Empty state - no guests at all */
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-muted">
            <UserIcon className="size-8 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium">{t("noGuests")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("newGuestDescription")}
            </p>
          </div>
          <Button onClick={() => nameInputRef.current?.focus()}>
            <PlusIcon />
            {t("addFirstGuest")}
          </Button>
        </div>
      ) : (
        /* No search results */
        <div className="py-12 text-center text-muted-foreground">
          {t("noResults")}
        </div>
      )}

      {/* ── Edit Dialog ─────────────────────────────────────── */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent
          key={`edit-${editPerson?.id ?? "none"}-${editCounter.current}`}
        >
          <DialogHeader>
            <DialogTitle>{t("editGuest")}</DialogTitle>
            <DialogDescription>{t("editGuestDescription")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">{tc("name")}</Label>
              <Input
                id="edit-name"
                name="name"
                defaultValue={editPerson?.name}
                placeholder={t("namePlaceholder")}
                required
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-booked-table">{t("bookedTable")}</Label>
              <Input
                id="edit-booked-table"
                name="booked_table"
                defaultValue={editPerson?.booked_table ?? ""}
                placeholder={t("bookedTablePlaceholder")}
                disabled={saving}
              />
            </div>
            <DialogFooter className="flex-row gap-2">
              {/* Delete button */}
              {editPerson && (
                <Button
                  type="button"
                  variant="outline"
                  className="text-destructive mr-auto"
                  onClick={() => setDeleteTarget(editPerson)}
                >
                  <Trash2Icon className="size-4" />
                  <span className="sm:hidden">{tc("delete")}</span>
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditDialogOpen(false)}
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

      {/* ── Delete Confirmation ─────────────────────────────── */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteGuest")}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? t("deleteGuestDescription", { name: deleteTarget.name })
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) handleDelete(deleteTarget.id)
              }}
            >
              {t("removeConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
